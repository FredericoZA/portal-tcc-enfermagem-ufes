import { DEFAULT_INSTALLATION_PROFILE } from '../constants/installation';
import { COMMITTEE_TREATMENTS, FACULTY_TREATMENTS, recordedAcademicName } from './personPresentation';
import type { ProcessData } from '../types';
import type { PublicLegacyAcademicRecord } from '../types/legacyArchive';

/** Use the existing repository/detail presentation without inventing live workflow data. */
export function legacyRepositoryProcess(record: PublicLegacyAcademicRecord): ProcessData {
  const advisor = (nome: string, instituicao: string, evidence?: PublicLegacyAcademicRecord['advisorAcademic']) => {
    const presentation = {...recordedAcademicName({nome}), ...evidence};
    const tratamento = FACULTY_TREATMENTS.find(value=>value===presentation.tratamento);
    return {nome,email:'',instituicao,tratamento,titulacao:presentation.titulacao};
  };
  const student = (nome: string) => ({nome,email:'',matricula:''});
  const full = record.publicFiles.find(f=>f.kind==='TRABALHO_COMPLETO');
  const summary = record.publicFiles.find(f=>f.kind==='RESUMO_EXPANDIDO');
  return {
    id:record.id, protocolo:record.protocolo, titulo:record.titulo, legacyRecord:true,
    etapaAtual:'CONCLUIDO', status:'CONCLUIDO', createdByEmail:'', dataRevision:0,
    createdAt:'', updatedAt:'', aluno1:student(record.autores[0]),
    aluno2:record.autores[1]?student(record.autores[1]):null,
    orientador:advisor(record.orientador,DEFAULT_INSTALLATION_PROFILE.institutionName,record.advisorAcademic),
    coorientador:record.coorientador?advisor(record.coorientador,record.coorientadorInstituicao):null,
    banca:record.examinadores.map((p,index)=>{
      const recorded = recordedAcademicName(p);
      return {id:`${record.id}-examinador-${index}`,nome:p.nome,email:'',instituicao:p.instituicao,
        tratamento:COMMITTEE_TREATMENTS.find(value=>value===recorded.tratamento),titulacao:recorded.titulacao,
        funcao:index===0?'EXAMINER_2':'EXAMINER_3'};
    }),
    defesa:{startAt:record.horaDefesa?`${record.dataDefesa}T${record.horaDefesa}-03:00`:record.dataDefesa,endAt:'',local:record.localDefesa},
    avaliacao:{status:'PENDENTE'},
    acervo:{resumoSintese:record.resumo,palavrasChave:record.palavrasChave,
      trabalhoCompletoFileUrl:full?.downloadUrl,resumoExpandidoFileUrl:summary?.downloadUrl,
      publishFullWork:Boolean(full),publishExpandedAbstract:Boolean(summary),isPublic:Boolean(full||summary)}
  };
}
