import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, value) => fs.writeFileSync(file, value);
const replaceOnce = (text, before, after, label) => {
  if (!text.includes(before)) throw new Error(`Trecho não encontrado: ${label}`);
  return text.replace(before, after);
};
const replaceBetween = (text, startMarker, endMarker, replacement, label) => {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Início não encontrado: ${label}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Fim não encontrado: ${label}`);
  return text.slice(0, start) + replacement + text.slice(end);
};

// 1) Tipo de acesso: a lista administrativa deixa de ser exclusiva de alunos.
{
  const file = 'src/types/index.ts';
  let text = read(file);
  text = replaceOnce(
    text,
    "  origin?: 'MASTER_LIST' | 'TCC_FORM';\n  roles?: ProcessRole[];",
    "  origin?: 'MASTER_LIST' | 'TCC_FORM';\n  roles?: ProcessRole[];\n  memberType?: 'INTERNAL' | 'EXTERNAL';",
    'memberType em AuthorizedStudent'
  );
  write(file, text);
}

// 2) API client: inclusão por papel/origem institucional e exclusão segura.
{
  const file = 'src/services/apiClient.ts';
  let text = read(file);
  text = replaceOnce(
    text,
    "  addAuthorizedStudent:(data:{nome:string;email:string;matricula?:string})=>fetchApi<any>('/api/admin/access-list',{method:'POST',body:JSON.stringify(data)}),\n  updateAuthorizedStudent:(id:string,data:any)=>fetchApi<any>(`/api/admin/access-list/${id}`,{method:'PATCH',body:JSON.stringify(data)}),\n  importAuthorizedStudents:(records:Array<{nome:string;email:string;matricula?:string}>)=>fetchApi<{batchHash:string;created:number;updated:number;preservedRevocations:number;reused:boolean}>('/api/admin/access-list/import',{method:'POST',body:JSON.stringify({records})}),",
    "  addAuthorizedStudent:(data:{nome:string;email:string;matricula?:string;role?:'STUDENT'|'ADVISOR'|'CO_ADVISOR'|'EXAMINER';memberType?:'INTERNAL'|'EXTERNAL'})=>fetchApi<any>('/api/admin/access-list',{method:'POST',body:JSON.stringify(data)}),\n  updateAuthorizedStudent:(id:string,data:any)=>fetchApi<any>(`/api/admin/access-list/${id}`,{method:'PATCH',body:JSON.stringify(data)}),\n  deleteAuthorizedStudent:(id:string)=>fetchApi<{deleted:boolean}>(`/api/admin/access-list/${id}`,{method:'DELETE'}),\n  importAuthorizedStudents:(records:Array<{nome:string;email:string;matricula?:string}>)=>fetchApi<{batchHash:string;created:number;updated:number;preservedRevocations:number;reused:boolean}>('/api/admin/access-list/import',{method:'POST',body:JSON.stringify({records})}),",
    'métodos da lista de acesso'
  );
  write(file, text);
}

// 3) Backend: lista de acesso geral, papel escolhido, reativação e exclusão somente quando segura.
{
  const file = 'server.ts';
  let text = read(file);
  const start = "  app.get(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(_req,res)=>res.json(authorizedStudentsStore));";
  const end = "\n  // GET /api/processes";
  const replacement = `  app.get(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(_req,res)=>res.json(authorizedStudentsStore));
  app.post(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;
    const email=normalizeEmail(String(req.body?.email||''));
    const nome=String(req.body?.nome||'').trim();
    const role=String(req.body?.role||'STUDENT').toUpperCase() as ProcessRole;
    const memberType=String(req.body?.memberType||'INTERNAL').toUpperCase()==='EXTERNAL'?'EXTERNAL':'INTERNAL';
    const matricula=String(req.body?.matricula||'').trim()||undefined;
    if(!nome||!isValidPortalEmail(email))return res.status(400).json({error:'Nome e e-mail válido são obrigatórios.'});
    if(!['STUDENT','ADVISOR','CO_ADVISOR','EXAMINER'].includes(role))return res.status(400).json({error:'Selecione um papel de acesso válido.'});
    if(role==='STUDENT'&&!matricula)return res.status(400).json({error:'Informe a matrícula para cadastrar um estudante.'});
    const existed=authorizedStudentsStore.some(entry=>normalizeEmail(entry.email)===email);
    const entry=upsertAuthorizedAccess({nome,email,matricula,role,origin:'MASTER_LIST',actor:identity.email,active:true});
    entry.memberType=memberType;
    entry.manualRevocation=false;entry.revokedAt=undefined;entry.revokedBy=undefined;entry.revocationReason=undefined;entry.updatedAt=new Date().toISOString();
    auditLogsStore.push({id:\`log-\${Date.now()}-access\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:existed?'ATUALIZACAO_ACESSO_AUTORIZADO':'CRIACAO_ACESSO_AUTORIZADO',entityType:'authorized_access',entityId:entry.id,after:{emailHash:createHash('sha256').update(entry.email).digest('hex'),roles:entry.roles,memberType:entry.memberType,origin:entry.origin,active:entry.active},timestamp:entry.updatedAt});
    persistPortalState();res.status(existed?200:201).json(entry);
  });
  app.patch(['/api/admin/access-list/:id','/api/admin/students/:id'],requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;const index=authorizedStudentsStore.findIndex(entry=>entry.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Acesso não encontrado.'});
    const before={...authorizedStudentsStore[index],roles:[...(authorizedStudentsStore[index].roles||[])]};
    const active=req.body?.active!==undefined?Boolean(req.body.active):before.active;
    const updatedAt=new Date().toISOString();
    const requestedRole=req.body?.role?String(req.body.role).toUpperCase() as ProcessRole:undefined;
    if(requestedRole&&!['STUDENT','ADVISOR','CO_ADVISOR','EXAMINER'].includes(requestedRole))return res.status(400).json({error:'Papel de acesso inválido.'});
    const roles=requestedRole?Array.from(new Set([...(before.roles||[before.accessType||'STUDENT']),requestedRole])) as ProcessRole[]:(before.roles||[before.accessType||'STUDENT']);
    const memberType=req.body?.memberType!==undefined?(String(req.body.memberType).toUpperCase()==='EXTERNAL'?'EXTERNAL':'INTERNAL'):before.memberType;
    const updated:AuthorizedStudent={...before,...(req.body?.nome!==undefined?{nome:String(req.body.nome).trim()}:{}),...(req.body?.matricula!==undefined?{matricula:String(req.body.matricula).trim()||undefined}:{}),roles,accessType:(before.accessType||roles[0]),memberType,active,manualRevocation:req.body?.active!==undefined?!active:before.manualRevocation,revokedAt:!active?updatedAt:undefined,revokedBy:!active?identity.email:undefined,revocationReason:!active?String(req.body?.reason||'Acesso revogado pelo administrador.').trim():undefined,updatedAt};
    authorizedStudentsStore[index]=updated;
    auditLogsStore.push({id:\`log-\${Date.now()}-access-update\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_ACESSO_AUTORIZADO',entityType:'authorized_access',entityId:updated.id,before:{active:before.active,roles:before.roles,memberType:before.memberType},after:{active:updated.active,roles:updated.roles,memberType:updated.memberType},timestamp:updated.updatedAt});
    persistPortalState();res.json(updated);
  });
  app.delete(['/api/admin/access-list/:id','/api/admin/students/:id'],requireAuthenticated,requireAdministrator,(req,res)=>{
    const identity=getPortalIdentity(req)!;const index=authorizedStudentsStore.findIndex(entry=>entry.id===req.params.id);
    if(index<0)return res.status(404).json({error:'Acesso não encontrado.'});
    const current=authorizedStudentsStore[index];
    if(current.origin==='TCC_FORM'||current.processIds.length>0)return res.status(409).json({error:'Este acesso está vinculado a um TCC. Desative o acesso em vez de excluir o vínculo acadêmico.',code:'ACCESS_LINKED_TO_PROCESS'});
    authorizedStudentsStore.splice(index,1);const now=new Date().toISOString();
    auditLogsStore.push({id:\`log-\${Date.now()}-access-delete\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'EXCLUSAO_ACESSO_MANUAL',entityType:'authorized_access',entityId:current.id,before:{emailHash:createHash('sha256').update(current.email).digest('hex'),roles:current.roles,memberType:current.memberType,origin:current.origin},timestamp:now});
    persistPortalState();res.json({deleted:true});
  });
  app.post('/api/admin/access-list/import',requireAuthenticated,requireAdministrator,requireFeature('STUDENT_BULK_IMPORT'),async(req,res)=>{
    const identity=getPortalIdentity(req)!;const records=Array.isArray(req.body?.records)?req.body.records:[];
    if(!records.length||records.length>1000)return res.status(400).json({error:'Envie de 1 a 1.000 alunos por lote.'});
    const normalized=records.map((record:any,index:number)=>({row:index+2,nome:String(record?.nome||'').trim(),email:normalizeEmail(String(record?.email||'')),matricula:String(record?.matricula||'').trim()||undefined}));
    const duplicateEmails=new Set<string>(),seen=new Set<string>();for(const record of normalized){if(seen.has(record.email))duplicateEmails.add(record.email);seen.add(record.email);}
    const profile=resolveInstallationProfile(currentSettings);const invalid=normalized.filter(record=>!record.nome||!record.matricula||!isValidPortalEmail(record.email)||!emailMatchesDomains(record.email,profile.studentEmailDomains)||duplicateEmails.has(record.email));
    if(invalid.length)return res.status(400).json({error:'O lote contém linhas inválidas ou duplicadas.',invalidRows:invalid.map(record=>({row:record.row,email:record.email,reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome, matrícula, e-mail institucional ou domínio inválido'}))});
    const batchHash=createHash('sha256').update(JSON.stringify(normalized.map(({nome,email,matricula})=>({nome,email,matricula})))).digest('hex');const already=auditLogsStore.find(log=>log.action==='IMPORTACAO_ALUNOS'&&(log.after as any)?.batchHash===batchHash);if(already)return res.json({batchHash,created:0,updated:0,reused:true});
    let created=0,updated=0,preservedRevocations=0;for(const record of normalized){const before=authorizedStudentsStore.find(entry=>normalizeEmail(entry.email)===record.email);if(before){before.nome=record.nome;before.matricula=record.matricula||before.matricula;before.updatedAt=new Date().toISOString();before.memberType=before.memberType||'INTERNAL';updated++;if(before.manualRevocation){before.active=false;preservedRevocations++;}}else{const createdEntry=upsertAuthorizedAccess({nome:record.nome,email:record.email,matricula:record.matricula,role:'STUDENT',origin:'MASTER_LIST',actor:identity.email});createdEntry.memberType='INTERNAL';created++;}}
    const now=new Date().toISOString();auditLogsStore.push({id:\`log-\${Date.now()}\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'IMPORTACAO_ALUNOS',entityType:'authorized_student_batch',entityId:batchHash.slice(0,20),after:{batchHash,rows:normalized.length,created,updated,preservedRevocations},timestamp:now});await persistPortalStateDurably();res.status(201).json({batchHash,created,updated,preservedRevocations,reused:false});
  });
`;
  text = replaceBetween(text, start, end, replacement, 'rotas de autorização de acesso');
  write(file, text);
}

// 4) Painel de autorização: papéis, origem, TCCs, ativo/inativo e exclusão manual.
{
  const file = 'src/components/AuthorizedStudentsPanel.tsx';
  write(file, `import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Plus, Search, Trash2, Upload, UserCheck, UserX } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AuthorizedStudent, ProcessRole } from '../types';
import { parseStudentImportFile, studentImportTemplateCsv, type StudentImportRow } from '../utils/studentImport';
import { portalConfirm } from '../services/portalDialogs';

const primaryButton='inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2d6c50] bg-[#337959] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-sm transition hover:brightness-95 disabled:opacity-50';
const inputClass='w-full min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const roleLabels:Record<ProcessRole,string>={STUDENT:'Aluno',ADVISOR:'Orientador',CO_ADVISOR:'Coorientador',EXAMINER:'Membro da banca'};
const roles:ProcessRole[]=['STUDENT','ADVISOR','CO_ADVISOR','EXAMINER'];

export const AuthorizedStudentsPanel:React.FC<{canManage:boolean}>=({canManage})=>{
  const [entries,setEntries]=useState<AuthorizedStudent[]>([]);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
  const [nome,setNome]=useState('');const [email,setEmail]=useState('');const [matricula,setMatricula]=useState('');const [role,setRole]=useState<ProcessRole>('STUDENT');const [memberType,setMemberType]=useState<'INTERNAL'|'EXTERNAL'>('INTERNAL');const [search,setSearch]=useState('');const [message,setMessage]=useState('');const [importRows,setImportRows]=useState<StudentImportRow[]>([]);
  const load=async()=>{setLoading(true);try{setEntries(await apiClient.getAuthorizedStudents());}catch(error){setMessage(error instanceof Error?error.message:'Falha ao carregar a lista.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const add=async(event:React.FormEvent)=>{event.preventDefault();setSaving(true);setMessage('');try{await apiClient.addAuthorizedStudent({nome,email,matricula:role==='STUDENT'?matricula||undefined:undefined,role,memberType});setNome('');setEmail('');setMatricula('');setMessage('Acesso cadastrado com sucesso.');await load();}catch(error){setMessage(error instanceof Error?error.message:'Falha ao cadastrar acesso.');}finally{setSaving(false);}};
  const toggle=async(entry:AuthorizedStudent)=>{try{await apiClient.updateAuthorizedStudent(entry.id,{active:!entry.active});await load();}catch(error){setMessage(error instanceof Error?error.message:'Falha ao alterar o acesso.');}};
  const addRole=async(entry:AuthorizedStudent,nextRole:ProcessRole)=>{if((entry.roles||[]).includes(nextRole))return;try{await apiClient.updateAuthorizedStudent(entry.id,{role:nextRole});await load();}catch(error){setMessage(error instanceof Error?error.message:'Falha ao acrescentar o papel.');}};
  const remove=async(entry:AuthorizedStudent)=>{if(!(await portalConfirm('Excluir este acesso manual? Esta ação não remove vínculos acadêmicos de TCC.')))return;try{await apiClient.deleteAuthorizedStudent(entry.id);setMessage('Acesso manual excluído.');await load();}catch(error){setMessage(error instanceof Error?error.message:'Falha ao excluir o acesso.');}};
  const readImport=async(file?:File)=>{if(!file)return;setMessage('');try{const rows=await parseStudentImportFile(file);setImportRows(rows);setMessage(\`\${rows.length} linha(s) pronta(s) para conferência.\`);}catch(error){setImportRows([]);setMessage(error instanceof Error?error.message:'Não foi possível ler a planilha.');}};
  const confirmImport=async()=>{setSaving(true);setMessage('');try{const result=await apiClient.importAuthorizedStudents(importRows);setMessage(result.reused?'Este mesmo lote já havia sido importado.':\`Importação concluída: \${result.created} criado(s), \${result.updated} atualizado(s).\`);setImportRows([]);await load();}catch(error){setMessage(error instanceof Error?error.message:'Falha ao importar alunos.');}finally{setSaving(false);}};
  const downloadTemplate=()=>{const url=URL.createObjectURL(new Blob([studentImportTemplateCsv()],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='modelo_lista_alunos.csv';link.click();URL.revokeObjectURL(url);};
  const visible=useMemo(()=>entries.filter(entry=>\`\${entry.nome} \${entry.email} \${entry.matricula||''} \${(entry.roles||[]).join(' ')} \${entry.memberType||''}\`.toLowerCase().includes(search.toLowerCase())),[entries,search]);
  const activeCount=entries.filter(entry=>entry.active).length,linkedCount=entries.filter(entry=>entry.processIds.length>0).length;
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-[#337959]"/><h3 className="font-black text-slate-950">Autorização de acesso</h3></div><p className="mt-1 text-[11px] leading-4 text-slate-600">Quem pode entrar no Portal e em qual qualidade. Vínculos criados por um TCC são identificados automaticamente e não podem ser apagados por engano.</p></div><div className="flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{entries.length} cadastrados</span><span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1">{activeCount} ativos</span><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{linkedCount} vinculados</span></div></div>
    {canManage&&<div className="grid gap-3 border-b border-slate-200 p-3 xl:grid-cols-[1.35fr_.65fr]"><form onSubmit={add} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Adicionar acesso individual</h4><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5"><input required value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome completo" className={inputClass}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail" className={inputClass}/><select value={role} onChange={e=>setRole(e.target.value as ProcessRole)} className={inputClass}>{roles.map(item=><option key={item} value={item}>{roleLabels[item]}</option>)}</select><select value={memberType} onChange={e=>setMemberType(e.target.value as 'INTERNAL'|'EXTERNAL')} className={inputClass}><option value="INTERNAL">Interno</option><option value="EXTERNAL">Externo</option></select><input required={role==='STUDENT'} disabled={role!=='STUDENT'} value={matricula} onChange={e=>setMatricula(e.target.value)} placeholder={role==='STUDENT'?'Matrícula':'Matrícula — não se aplica'} className={inputClass}/></div><button disabled={saving} className={\`\${primaryButton} mt-2\`}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}Adicionar acesso</button></form><div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-[#337959]"/><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Lista prévia de alunos</h4></div><p className="mt-1 text-[10px] leading-4 text-slate-500">CSV/XLSX: nome, e-mail e matrícula. Importação em lote é exclusiva de estudantes.</p></div><button type="button" onClick={downloadTemplate} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-[10px] font-black">Modelo</button></div><label className={\`\${primaryButton} mt-2 cursor-pointer\`}><Upload className="h-4 w-4"/>Selecionar planilha<input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>void readImport(e.target.files?.[0])}/></label></div>{importRows.length>0&&<div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-3"><div className="max-h-48 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-[#005830] text-white"><tr><th className="p-2">Linha</th><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Matrícula</th></tr></thead><tbody>{importRows.slice(0,100).map(row=><tr key={\`\${row.row}-\${row.email}\`} className="border-t border-slate-100"><td className="p-2">{row.row}</td><td className="p-2">{row.nome||'—'}</td><td className="p-2">{row.email||'—'}</td><td className="p-2">{row.matricula||'—'}</td></tr>)}</tbody></table></div><div className="mt-2 flex items-center justify-end"><button type="button" disabled={saving} onClick={confirmImport} className={primaryButton}>Confirmar {importRows.length} aluno(s)</button></div></div>}</div>}
    <div className="p-3">{message&&<p role="status" className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p>}<label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, matrícula ou papel" className="w-full min-h-10 rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs outline-none"/></label><div className="mt-2 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1040px] border-collapse text-left"><thead className="bg-[#005830] text-[10px] font-black uppercase tracking-wider text-white"><tr><th className="px-3 py-2.5">Nome</th><th className="px-3 py-2.5">E-mail</th><th className="px-3 py-2.5">Matrícula</th><th className="px-3 py-2.5">Origem</th><th className="px-3 py-2.5">Papel</th><th className="px-3 py-2.5">Tipo</th><th className="px-3 py-2.5 text-center">TCCs</th><th className="px-3 py-2.5 text-center">Acesso</th><th className="px-3 py-2.5 text-center">Excluir</th></tr></thead><tbody className="divide-y divide-slate-100">{loading?<tr><td colSpan={9} className="p-8 text-center text-sm text-slate-500">Carregando…</td></tr>:visible.length===0?<tr><td colSpan={9} className="p-8 text-center text-sm text-slate-500">Nenhum acesso encontrado.</td></tr>:visible.map(entry=>{const entryRoles=(entry.roles?.length?entry.roles:[entry.accessType||'STUDENT']) as ProcessRole[];const canDelete=entry.origin!=='TCC_FORM'&&entry.processIds.length===0;return <tr key={entry.id} className="hover:bg-slate-50/70"><td className="px-3 py-2.5 text-xs font-bold text-slate-900">{entry.nome}</td><td className="px-3 py-2.5 text-xs text-slate-600">{entry.email}</td><td className="px-3 py-2.5 text-xs text-slate-600">{entry.matricula||'—'}</td><td className="px-3 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-700">{entry.origin==='MASTER_LIST'?'Lista prévia/manual':'Incluído pelo TCC'}</span></td><td className="px-3 py-2.5"><div className="flex flex-wrap items-center gap-1">{entryRoles.map(item=><span key={item} className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-slate-700">{roleLabels[item]}</span>)}{canManage&&<select aria-label={\`Adicionar papel para \${entry.nome}\`} defaultValue="" onChange={e=>{if(e.target.value){void addRole(entry,e.target.value as ProcessRole);e.currentTarget.value='';}} className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[9px] font-bold"><option value="">+ papel</option>{roles.filter(item=>!entryRoles.includes(item)).map(item=><option key={item} value={item}>{roleLabels[item]}</option>)}</select>}</div></td><td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{entry.memberType==='EXTERNAL'?'Externo':'Interno'}</td><td className="px-3 py-2.5 text-center text-xs font-bold text-slate-700">{entry.processIds.length}</td><td className="px-3 py-2.5 text-center">{canManage?<button type="button" onClick={()=>void toggle(entry)} className={\`inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-[10px] font-black \${entry.active?'border-slate-300 bg-white text-slate-800':'border-slate-300 bg-[#AEB0B3] text-slate-900'}\`}>{entry.active?<CheckCircle2 className="h-3.5 w-3.5"/>:<UserX className="h-3.5 w-3.5"/>}{entry.active?'Ativo':'Inativo'}</button>:<span className="text-xs">{entry.active?'Ativo':'Inativo'}</span>}</td><td className="px-3 py-2.5 text-center">{canManage?<button type="button" disabled={!canDelete} onClick={()=>void remove(entry)} title={canDelete?'Excluir acesso manual':'Vínculo acadêmico: desative o acesso em vez de excluir'} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5"/></button>:'—'}</td></tr>;})}</tbody></table></div></div>
  </section>;
};
`);
}

// 5) Sincronização passa a ser a central de governança + integrações + acessos.
{
  const file='src/pages/ConfiguracoesPage.tsx';let text=read(file);
  text=replaceOnce(text,"import { AuditAndSecuritySection, AuditLogsTable } from '../components/AuditAndSecuritySection';","import { AuditAndSecuritySection, AuditLogsTable, MasterAndPresidentConfigForm } from '../components/AuditAndSecuritySection';\nimport { CommissionIdentityPanel } from '../components/CommissionIdentityPanel';",'imports de governança');
  text=replaceOnce(text,"            <InfrastructureIntegrationsPanel isMaster={isMasterAdmin} />\n            {isMasterAdmin && <AuthorizedStudentsPanel canManage />}","            {isMasterAdmin && settings && (\n              <MasterAndPresidentConfigForm settings={settings} onSettingsUpdated={() => { void refreshAuth(); showNotification('Contas administrativas atualizadas.'); }} showNotification={showNotification} />\n            )}\n            {isMasterAdmin && <CommissionIdentityPanel isMaster />}\n            <InfrastructureIntegrationsPanel isMaster={isMasterAdmin} />\n            {isMasterAdmin && <AuthorizedStudentsPanel canManage />}",'conteúdo da sincronização');
  text=text.replace(/>\s*Sincronização\s*</g,'>Sincronização e acessos<');
  write(file,text);
}

// 6) Rodapé deriva Presidente e responsável técnico das contas configuradas; campos visuais ficam só como fallback.
{
  const file='src/components/Footer.tsx';let text=read(file);
  text=replaceOnce(text,"  const devName=layoutConfig.footerDevName||settings?.portalMaintainerName||'Equipe responsável pela instalação';","  const devName=settings?.ownerName||settings?.portalMaintainerName||layoutConfig.footerDevName||'Equipe responsável pela instalação';",'nome do Master no rodapé');
  write(file,text);
}

// 7) Aparência pública é carregada independentemente da sessão: falha do /me não apaga identidade do visitante.
{
  const file='src/context/AuthContext.tsx';let text=read(file);
  const start='  const refreshAuth = async () => {';const end='\n\n  useEffect(() => {';
  const replacement=`  const applyPublicSettings = (rawSettings: GlobalSettings) => {
    const settingsRes=normalizeUnifiedAppearance(rawSettings);setSettings(settingsRes);
    if(settingsRes.portalAppearance&&typeof window!=='undefined'){
      const appearance=settingsRes.portalAppearance;
      if(appearance.globalPopupStyle)saveGlobalPopupStyle(appearance.globalPopupStyle);
      const globalTableAppearance=settingsRes.tableAppearance||{};
      if(appearance.linkedItems)savePortalAppearanceLinks(appearance.linkedItems,globalTableAppearance as Record<string,unknown>,false);
      if(settingsRes.tableLayouts){const canonicalLayouts:Record<string,unknown>={};const legacyStorageKeys:Record<string,string>={defesas:'defenses',coordenador:'coordinator'};Object.entries(settingsRes.tableLayouts).forEach(([rawKey,rawLayout])=>{const key=legacyStorageKeys[rawKey]||rawKey;const layout=rawLayout&&typeof rawLayout==='object'?{...(rawLayout as Record<string,unknown>)}:{};if(tableInheritsGlobalAppearance(key))delete (layout as any).textFormat;(layout as any).inheritGlobalAppearance=tableInheritsGlobalAppearance(key);canonicalLayouts[key]=layout;});Object.values(TABLE_STORAGE_BY_EDITOR_TAB).forEach(key=>{const layout=canonicalLayouts[key];if(layout)localStorage.setItem(\`default_table_config_\${key}\`,JSON.stringify(layout));});window.dispatchEvent(new CustomEvent(TABLE_LAYOUTS_EVENT,{detail:canonicalLayouts}));}
      if(appearance.siteConfig){saveSiteLayoutConfig(appearance.siteConfig as any);syncPortalFavicon(appearance.siteConfig);}else syncPortalFavicon(loadSiteLayoutConfig());
      if(appearance.calendarPopup)saveCalendarPopupConfig(appearance.calendarPopup as any);if(appearance.tccDetailPopup)saveTccDetailPopupFormat(appearance.tccDetailPopup as any);if(appearance.loginPopup)saveLoginPopupConfig(appearance.loginPopup as any);if(appearance.generalPopups)saveGeneralPopupsConfig(appearance.generalPopups as any);
    }else syncPortalFavicon(loadSiteLayoutConfig());
    if(settingsRes.tableAppearance)saveGlobalTableConfig(settingsRes.tableAppearance);
    if(settingsRes.integrationStudio?.operationsPolicy&&typeof document!=='undefined'){const policy=settingsRes.integrationStudio.operationsPolicy;document.documentElement.lang=policy.defaultLocale||'pt-BR';document.documentElement.style.setProperty('--portal-target-size',\`\${policy.accessibility?.minimumTargetSize||44}px\`);document.documentElement.dataset.portalMotion=policy.accessibility?.reducedMotionByDefault?'reduced':'system';}
  };

  const refreshAuth=async()=>{
    setIsLoading(true);
    const settingsTask=apiClient.getSettings().then(applyPublicSettings).catch(err=>{console.error('Erro ao carregar aparência pública do portal:',err);syncPortalFavicon(loadSiteLayoutConfig());});
    const identityTask=apiClient.getMe().then(meRes=>{setUserEmailState(meRes.userEmail);setIsAuthenticated(meRes.isAuthenticated);setGlobalRoles(meRes.globalRoles);setMemberships(meRes.memberships);}).catch(err=>{console.warn('Sessão não confirmada; mantendo o Portal em modo público.',err);setUserEmailState('');setIsAuthenticated(false);setGlobalRoles([]);setMemberships([]);});
    await Promise.allSettled([settingsTask,identityTask]);setIsLoading(false);
  };`;
  text=replaceBetween(text,start,end,replacement,'refreshAuth independente');write(file,text);
}

// 8) Remover definitivamente referências à declaração de ouvinte do editor de aparência.
{
  const file='src/components/UnifiedPortalEditorModal.tsx';let text=read(file);
  text=text.replaceAll('Solicitação de Declaração de Ouvinte ou Correção','Solicitação de Correção');
  text=text.replaceAll('Preencha seus dados para solicitar certidão de participação como ouvinte.','Descreva a correção necessária no documento para análise administrativa.');
  text=text.replaceAll('Declaração de Ouvinte','Correção de Documento');
  text=text.replaceAll('declaração de ouvinte','correção de documento');
  text=text.replaceAll('ouvinte','solicitante');
  write(file,text);
}

// 9) Hub de personalização cobre todas as superfícies relevantes, em cartões compactos.
{
  const file='src/components/PortalPersonalizationHubModal.tsx';
  write(file,`import React from 'react';
import { createPortal } from 'react-dom';
import { Palette, X } from 'lucide-react';

interface Props{isOpen:boolean;onClose:()=>void;onOpenAppearance:(target:string)=>void;}
const screens=[['Barra superior','site_header'],['Barra lateral','site_sidebar'],['Rodapé','site_footer'],['Login e acesso','popup_login'],['Calendário','sheet_calendar'],['Repositório','sheet_repository'],['Meus TCCs','sheet_my_tccs'],['Área do Presidente','sheet_coordinator'],['Indicadores','global_table_style'],['Como chegar','global_table_buttons'],['Como usar','global_table_style'],['Fluxo do TCC','global_table_style'],['Replicar Portal','global_table_style'],['Configurações','global_table_style'],['Detalhe do TCC','popup_tcc_detail'],['Nova defesa','popup_new_defense'],['Upload de Ata','popup_upload_ata'],['Visualização PDF','popup_pdf_viewer'],['Correção de documento','popup_correction'],['Pop-ups e formulários','global_popup_style']] as const;
export const PortalPersonalizationHubModal:React.FC<Props>=({isOpen,onClose,onOpenAppearance})=>{if(!isOpen)return null;return createPortal(<div className="fixed inset-0 z-[1000000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm"><div id="portal-personalization-hub" role="dialog" aria-modal="true" aria-label="Personalização do Portal TCC" className="my-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] shadow-2xl"><header className="flex items-center justify-between bg-[#337959] px-4 py-3 text-white"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/70 bg-white"><Palette className="h-4 w-4 text-[#337959]"/></span><h2 className="text-left text-sm font-black uppercase tracking-wide">Personalização do Portal TCC</h2></div><button type="button" onClick={onClose} className="rounded-lg border border-white/70 bg-white p-1.5 text-slate-800" aria-label="Fechar"><X className="h-4 w-4"/></button></header><div className="p-3 sm:p-4"><p className="mb-3 text-[11px] leading-4 text-slate-600">Aparência global definida pelo Master e aplicada a visitantes e usuários autenticados. Colunas e ordem continuam na engrenagem de cada planilha.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{screens.map(([label,target])=><button key={label} type="button" onClick={()=>{onClose();onOpenAppearance(target);}} className="min-h-16 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-slate-50"><div className="text-[10px] font-black uppercase tracking-wide text-slate-900">{label}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">Cores, fonte, títulos, espaçamento, bordas, botões e superfícies aplicáveis.</div></button>)}</div><div className="mt-3 flex justify-end border-t border-slate-300 pt-3"><button type="button" onClick={()=>{onClose();onOpenAppearance('quick_presets');}} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#2d6c50] bg-[#337959] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm"><Palette className="h-4 w-4"/>Ajustes globais</button></div></div></div></div>,document.body);};
`);
  const configFile='src/pages/ConfiguracoesPage.tsx';let config=read(configFile);
  config=replaceOnce(config,"          onOpenAppearance={() => openUnifiedEditor('site_header')}","          onOpenAppearance={(target) => openUnifiedEditor(target as UnifiedEditorTab)}",'callback do hub');
  write(configFile,config);
}

// 10) Contratos: impedem que o restante desta rodada volte a regredir.
write('server/update33CompletionContract.test.ts',`import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.cwd());const source=(file:string)=>readFile(path.join(root,file),'utf8');
test('acessos administrativos suportam papéis, ativação e exclusão segura',async()=>{const [server,panel,client,types]=await Promise.all([source('server.ts'),source('src/components/AuthorizedStudentsPanel.tsx'),source('src/services/apiClient.ts'),source('src/types/index.ts')]);assert.ok(server.includes("['STUDENT','ADVISOR','CO_ADVISOR','EXAMINER']"));assert.ok(server.includes("app.delete(['/api/admin/access-list/:id'"));assert.ok(server.includes('ACCESS_LINKED_TO_PROCESS'));assert.ok(panel.includes('Adicionar acesso individual'));assert.ok(panel.includes('Membro da banca'));assert.ok(panel.includes('Lista prévia/manual'));assert.ok(panel.includes('Excluir'));assert.ok(client.includes('deleteAuthorizedStudent'));assert.ok(types.includes("memberType?: 'INTERNAL' | 'EXTERNAL'"));});
test('sincronização reúne governança, integrações e autorização',async()=>{const config=await source('src/pages/ConfiguracoesPage.tsx');for(const required of ['MasterAndPresidentConfigForm','CommissionIdentityPanel','InfrastructureIntegrationsPanel','AuthorizedStudentsPanel'])assert.ok(config.includes(required));});
test('aparência pública não depende da confirmação da sessão',async()=>{const auth=await source('src/context/AuthContext.tsx');assert.ok(auth.includes('Promise.allSettled([settingsTask,identityTask])'));assert.ok(auth.includes('applyPublicSettings'));});
test('declaração de ouvinte não existe na personalização',async()=>{const editor=(await source('src/components/UnifiedPortalEditorModal.tsx')).toLowerCase();assert.ok(!editor.includes('ouvinte'));});
test('rodapé deriva responsável técnico da conta Master',async()=>{const footer=await source('src/components/Footer.tsx');assert.ok(footer.includes("settings?.ownerName||settings?.portalMaintainerName||layoutConfig.footerDevName"));});
test('hub de personalização cobre telas públicas e restritas',async()=>{const hub=await source('src/components/PortalPersonalizationHubModal.tsx');for(const label of ['Como usar','Replicar Portal','Configurações','Área do Presidente','Indicadores'])assert.ok(hub.includes(label));});
`);

// Limpa o mecanismo temporário para a branch terminar sem automação residual.
for(const temp of ['scripts/complete-update33.mjs','.github/workflows/complete-update33.yml']){try{fs.unlinkSync(temp);}catch{}}
console.log('Fechamento funcional da atualização 33 aplicado.');
