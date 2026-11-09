import { DEFAULT_INSTALLATION_PROFILE } from '../constants/installation';
import type { ProcessData } from '../types';
import type { PublicLegacyAcademicRecord } from '../types/legacyArchive';

/** Use the existing repository/detail presentation without inventing live workflow data. */
export function legacyRepositoryProcess(record: PublicLegacyAcademicRecord): ProcessData {
  const student = (nome: string) => ({nome,email:'',matricula:''});
  const full = record.publicFiles.find(f=>f.kind==='TRABALHO_COMPLETO');
  const summary = record.publicFiles.find(f=>f.kind==='RESUMO_EXPANDIDO');
  return {
    id:record.id, protocolo:record.protocolo, titulo:record.titulo, legacyRecord:true,
    etapaAtual:'CONCLUIDO', status:'CONCLUIDO', createdByEmail:'', dataRevision:0,
    createdAt:'', updatedAt:'', aluno1:student(record.autores[0]),
    aluno2:record.autores[1]?student(record.autores[1]):null,
    orientador:{nome:record.orientador,email:'',instituicao:DEFAULT_INSTALLATION_PROFILE.institutionName},
    coorientador:record.coorientador?{nome:record.coorientador,email:'',instituicao:record.coorientadorInstituicao}:null,
    banca:record.examinadores.map((p,index)=>({id:`${record.id}-examinador-${index}`,nome:p.nome,email:'',instituicao:p.instituicao,funcao:index===0?'EXAMINER_2':'EXAMINER_3'})),
    defesa:{startAt:record.horaDefesa?`${record.dataDefesa}T${record.horaDefesa}-03:00`:record.dataDefesa,endAt:'',local:record.localDefesa},
    avaliacao:{status:'PENDENTE'},
    acervo:{resumoSintese:record.resumo,palavrasChave:record.palavrasChave,
      trabalhoCompletoFileUrl:full?.downloadUrl,resumoExpandidoFileUrl:summary?.downloadUrl,
      publishFullWork:Boolean(full),publishExpandedAbstract:Boolean(summary),isPublic:Boolean(full||summary)}
  };
}
