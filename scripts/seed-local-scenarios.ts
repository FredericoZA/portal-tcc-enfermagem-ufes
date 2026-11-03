// Cenários persistentes para revisão humana. Acrescenta somente IDs ausentes.
import dotenv from 'dotenv';
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import net from 'node:net';
import {LOCAL_REVIEW_SCENARIOS,reviewStudentEmail} from '../src/utils/localReviewScenarios';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {createProfessionalPdf} from '../server/documents/simplePdf';
import {localReviewFilesEnabled,storeReviewPdf} from '../server/localReviewFiles';
dotenv.config({path:'.env.local',override:false,quiet:true});
if(!localReviewFilesEnabled())throw new Error('Exige modo local de demonstração, sem Vercel.');
const listening=await new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port:Number(process.env.PORT||3000)});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));});
if(listening)throw new Error('Encerre o servidor antes de preparar os cenários.');
const file='.portal-data/portal-state.json',state=JSON.parse(readFileSync(file,'utf8'));
const settingsBefore=JSON.stringify(state.settings),now=new Date().toISOString();
mkdirSync('.portal-data/backups',{recursive:true});const backup=`.portal-data/backups/antes-cenarios-${Date.now()}.json`;copyFileSync(file,backup);
const names=LOCAL_REVIEW_SCENARIOS;
const manifest=[];
for(let i=0;i<names.length;i++){
 const id=`qa58-${String(i+1).padStart(2,'0')}`,protocol=`QA-2026-${String(i+1).padStart(4,'0')}`;
 if(state.processes.some((p:any)=>p.id===id)){manifest.push({id,protocol,scenario:names[i],preserved:true});continue;}
 const p=structuredClone(DEMO_PROCESSES[0]);Object.assign(p,{id,protocolo:protocol,titulo:`[TESTE LOCAL] ${names[i]}`,dataRevision:1,createdAt:now,updatedAt:now,createdByEmail:'mariana.silva@aluno.ufes.br'});
 p.aluno1={...p.aluno1,nome:`Autor de teste ${i+1}`,email:reviewStudentEmail(i),matricula:`QA58${String(i+1).padStart(4,'0')}`};p.createdByEmail=p.aluno1.email;p.banca=p.banca.filter(member=>member.funcao!=='ORIENTADOR');
 p.aluno2={nome:'João Pedro (teste)',email:`coautor.qa58.${i+1}@edu.ufes.br`,matricula:'QA580002'};p.coorientador=null;
 const start=new Date();start.setUTCDate(start.getUTCDate()+3+i);while([0,6].includes(start.getUTCDay()))start.setUTCDate(start.getUTCDate()+1);start.setUTCHours(13+(i%6),0,0,0);
 p.defesa={startAt:start.toISOString(),endAt:new Date(+start+5400000).toISOString(),local:'Sala de testes locais',localStatus:i<2?'PENDENTE':'CONFIRMADO'};
 p.avaliacao=i<4?{status:'PENDENTE'}:{status:'CONCLUIDO',nota:9,notaFinal:9,resultadoCode:'APROVADO',resultadoLabel:'Aprovado',parecer:'Parecer fictício sem validade acadêmica.',submittedAt:now,submittedBy:p.orientador.email};
 p.status=i<2?'AGUARDANDO_CONFIRMACAO_LOCAL':i<4?'AGUARDANDO_DEFESA':i===4?'AGUARDANDO_ASSINATURA':'AGUARDANDO_DADOS_FINAIS';
 p.etapaAtual=i<2?'CONFIRMACAO_LOCAL':i<4?'DEFESA':i===4?'ASSINATURA':'REPOSITORIO';
 p.acervo={palavrasChave:i>=6?['Enfermagem','Teste','Segurança','Ensino','Cuidado']:[],resumoSintese:i>=6?'Resumo de demonstração local. Objetivo: testar a entrega. Método: dados fictícios. Resultado: conferência das opções de publicação e dos arquivos.':'',publishFullWork:i===10,publishExpandedAbstract:i===8,isPublic:false,publicationState:'NOT_REQUESTED'};
 const pdf=await createProfessionalPdf({title:'DOCUMENTO FICTÍCIO — SEM VALIDADE',protocol,body:`Cenário: ${names[i]}. Arquivo de teste local. Não é documento acadêmico nem assinatura eletrônica real.`});const sha=createHash('sha256').update(pdf).digest('hex');
 const save=(type:string)=>storeReviewPdf({processId:id,artifactType:type,fileName:`${protocol}_${type}_TESTE.pdf`,pdf,sha256:sha});
 if(i>=1){const proof=save('COMPROVANTE_LOCAL');p.defesa.locationProof={driveFileId:proof.id,fileName:proof.name,sha256:sha,version:1,uploadedBy:p.aluno1.email,uploadedAt:now};}
 if(i>=2){p.defesa.invitationDriveFileId=save('CONVITE').id;p.defesa.invitationSentAt=now;}
 if(i>=6){const f=save('TRABALHO_COMPLETO');Object.assign(p.acervo,{trabalhoCompletoFileId:f.id,trabalhoCompletoFileName:f.name,trabalhoCompletoFileUrl:`/api/processes/${id}/files/trabalho-completo/download`,trabalhoCompletoSha256:sha,trabalhoCompletoVersion:1});}
 if([7,8,10].includes(i)){const f=save('RESUMO_EXPANDIDO');Object.assign(p.acervo,{resumoExpandidoFileId:f.id,resumoExpandidoFileName:f.name,resumoExpandidoFileUrl:`/api/processes/${id}/files/resumo-expandido/download`,resumoExpandidoSha256:sha,resumoExpandidoVersion:1});}
 if(i>=9)Object.assign(p.acervo,{submittedAt:now,submittedBy:p.aluno1.email,...(i===10?{authorizationConfirmedAt:now,publicationState:'PENDING_SYNC'}:{})});
 // Assinatura concluída é apenas estado de teste, sem envelope/verificador público.
 if(i>=5){const f=save('ATA');state.signatureJobs.push({id:`${id}-ata-simulada`,processId:id,protocol,documentType:'ATA',documentTitle:'ATA — SIMULAÇÃO LOCAL SEM ASSINATURA REAL',documentVersion:1,sourceDataRevision:1,fileName:f.name,mimeType:'application/pdf',contentSha256:sha,signedSha256:sha,idempotencyKey:`${id}-fixture`,status:'ARCHIVED',provider:'ASTEN',driveSignedFileId:f.id,signers:[{id:`${id}-advisor`,role:'ADVISOR',name:p.orientador.nome,email:p.orientador.email,signingOrder:1,status:'SIGNED'}],createdAt:now,updatedAt:now,completedAt:now,createdBy:'master@portal.local',lastError:'SIMULAÇÃO LOCAL. Nenhuma assinatura real foi executada.'});}
 state.processes.push(p);
 for(const [email,roles] of [[p.aluno1.email,['STUDENT']],[p.aluno2.email,['STUDENT']],[p.orientador.email,['ADVISOR']],...p.banca.map(b=>[b.email,['EXAMINER']])] as [string,string[]][])state.memberships.push({id:`${id}-${email}`,processId:id,email,roles,active:true,createdAt:now,updatedAt:now});
 state.auditLogs.push({id:`${id}-created`,processId:id,actorEmail:'master@portal.local',actorRoles:['MASTER_ADMIN'],action:'CENARIO_LOCAL_FICTICIO',entityType:'processo',entityId:id,after:{scenario:names[i],semValidade:true},timestamp:now});
 manifest.push({id,protocol,scenario:names[i],student:p.aluno1.email,url:`http://localhost:3000/?tcc=${id}&secao=${i>=5?'acervo':'geral'}`});
}
if(JSON.stringify(state.settings)!==settingsBefore)throw new Error('Configurações não podem mudar.');
writeFileSync(file+'.tmp',JSON.stringify(state,null,2),{mode:0o600});renameSync(file+'.tmp',file);
writeFileSync('.portal-data/cenarios-de-teste.json',JSON.stringify({backup,scenarios:manifest},null,2));
console.log(JSON.stringify({backup,total:state.processes.length,scenarios:manifest},null,2));
