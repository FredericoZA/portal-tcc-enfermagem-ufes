import type {ProcessData} from '../../src/types';
import {createHash} from 'node:crypto';

/** Only the persisted authors and advisor are automatically enrolled. */
export function processDriveReaderEmails(process:Pick<ProcessData,'aluno1'|'aluno2'|'orientador'>):string[]{
  return [...new Set([process.aluno1?.email,process.aluno2?.email,process.orientador?.email]
    .map(value=>String(value||'').trim().toLowerCase()).filter(value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
}

/** Caller must validate the process/file binding before using this internal helper. */
export async function grantMissingDriveReaders(accessToken:string,fileId:string,emails:readonly string[],permissions:any[],managedProperties?:Record<string,string>):Promise<boolean>{
  let changed=false;const updates:Record<string,string|null>={};
  const readers=[...new Set(emails.map(value=>value.trim().toLowerCase()))];
  const key=(email:string)=>`portalReader_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0,24)}`;
  const created:string[]=[];
  try {
  for(const email of readers){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Destinatário de leitura do Drive inválido.');
    if(permissions.some(p=>p.type==='user'&&String(p.emailAddress||'').toLowerCase()===email&&p.view!=='metadata'&&['owner','reader','commenter','writer','organizer','fileOrganizer'].includes(p.role)))continue;
    const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false&supportsAllDrives=true&fields=id,type,role,emailAddress`,{
      method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({type:'user',role:'reader',emailAddress:email}),signal:AbortSignal.timeout(20000),
    });
    if(!response.ok)throw Error(`Não foi possível compartilhar a leitura do arquivo no Drive (${response.status}).`);
    const permission=await response.json();
    if(!permission.id||permission.type!=='user'||permission.role!=='reader'||String(permission.emailAddress||'').toLowerCase()!==email)throw Error('O Drive não confirmou a permissão de leitura solicitada.');
    created.push(permission.id);
    if(managedProperties)updates[key(email)]=permission.id;
    permissions.push(permission);changed=true;
  }
  // Revoke only readers enrolled by this helper. Leave manual grants and owner alone.
  for(const [name,id] of Object.entries(managedProperties||{})){
    if(!/^portalReader_[a-f0-9]{24}$/.test(name)||readers.some(email=>key(email)===name))continue;
    const permission=permissions.find(p=>p.id===id);
    if(permission){
      if(permission.role!=='reader'||permission.type!=='user'||key(String(permission.emailAddress||''))!==name)throw Error('A permissão gerenciada mudou; confira o acesso no Drive.');
      const removed=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(id)}?supportsAllDrives=true`,{method:'DELETE',headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(20000)});
      if(!removed.ok&&removed.status!==404)throw Error('Não foi possível retirar a leitura de um participante anterior.');
      const index=permissions.indexOf(permission);permissions.splice(index,1);changed=true;
    }
    updates[name]=null;
  }
  if(Object.keys(updates).length){
    const saved=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id`,{method:'PATCH',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({appProperties:updates}),signal:AbortSignal.timeout(20000)});
    if(!saved.ok)throw Error('Não foi possível registrar a sincronização das permissões no Drive.');
  }
  return changed;
  }catch(error){
    let rollbackFailed=false;
    for(const id of created){
      try{const removed=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(id)}?supportsAllDrives=true`,{method:'DELETE',headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(20000)});if(!removed.ok&&removed.status!==404)rollbackFailed=true;}
      catch{rollbackFailed=true;}
    }
    if(rollbackFailed)throw Error('A sincronização de leitura falhou e exige conferência das permissões no Drive.');
    throw error;
  }
}

