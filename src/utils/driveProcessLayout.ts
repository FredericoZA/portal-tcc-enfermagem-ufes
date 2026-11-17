import type { ProcessData } from '../types';
import type { LegacyAcademicRecord } from '../types/legacyArchive';
import {normalizePersonName} from './personNameCase';

export const DRIVE_ACADEMIC_FOLDER_NAMES = {documents:'Documentos',processes:'Processos'} as const;
export const DRIVE_ACADEMIC_FOLDER_ALIASES = {
  documents:['Documentos','01_DOCUMENTOS'], processes:['Processos','02_PROCESSOS']
} as const;

function clean(value:unknown):string {
  return String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g,' ').replace(/\s+/g,' ').trim();
}

/** Sort only the label; never reorder the academic author record. */
export function driveProcessAuthorLabel(studentNames:readonly string[]):string {
  const particles=new Set(['de','da','do','das','dos','e']);
  return studentNames.map(name=>clean(name)).filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR'))
    .map(name=>normalizePersonName(name.split(/\s+/).filter(part=>!particles.has(part.toLowerCase())).slice(0,2).join(' '))).filter(Boolean).join(' e ');
}

export function buildDriveProcessFolderName(input:{protocol:string;studentNames:readonly string[];legacy?:boolean}):string {
  const protocol=clean(input.protocol)||'Sem código';
  const authors=driveProcessAuthorLabel(input.studentNames);
  return `${protocol}${authors?` - ${authors}`:''}`;
}

const FILE_LABELS:Record<string,string>={
  DADOS:'00 - Dados do processo',REGISTRO_HISTORICO:'00 - Registro histórico',
  CONFIRMACAO_LOCAL:'01 - Comprovante de reserva',COMPROVANTE_LOCAL:'01 - Comprovante de reserva',
  CONVITE:'02 - Carta-convite',ATA:'03 - Ata de defesa',TERMO:'04 - Termo de autorização',
  DECLARACAO:'05 - Declaração de participação',TRABALHO_COMPLETO:'06 - TCC',RESUMO_EXPANDIDO:'07 - Resumo expandido',
  AVALIACAO_LEGADO:'08 - Avaliação do legado',
  CADASTRO_INICIAL:'00 - Registro de cadastro inicial',AVALIACAO:'00 - Registro de avaliação',DADOS_FINAIS:'00 - Registro de entrega final'
};

export function buildDriveProcessFileName(input:{protocol?:string;studentNames?:readonly string[];kind:string;version?:number;lifecycle?:'GERADO'|'ASSINADO';extension?:string}):string {
  const kind=input.kind.replace(/^FORMULARIO_/,''),label=FILE_LABELS[kind]||`00 - Registro ${clean(kind).replace(/_/g,' ')||'complementar'}`;
  const identity=[clean(input.protocol),driveProcessAuthorLabel(input.studentNames||[])].filter(Boolean).join(' - ');
  const version=input.version===undefined?'':` - v${String(Math.max(1,Math.floor(input.version)||1)).padStart(3,'0')}`;
  const lifecycle=input.lifecycle?` - ${input.lifecycle==='ASSINADO'?'Assinado':'Gerado'}`:'';
  const extension=String(input.extension||(kind==='DADOS'?'md':'pdf')).replace(/[^a-z0-9]/gi,'').toLowerCase()||'pdf';
  if(kind==='DADOS')return `${label}.${extension}`;
  return `${label}${identity?` - ${identity}`:''}${version}${lifecycle}.${extension}`;
}

function markdownText(value:unknown):string {
  const text=String(value??'').replace(/\r\n?/g,'\n').trim();
  return text?text.replace(/[\\`*_{}\[\]<>#|]/g,'\\$&'):'Não cadastrado';
}

/** Explicit academic projection: never serialize raw process/provenance, contacts or credentials. */
export function buildDriveProcessDataMarkdown(record:ProcessData|LegacyAcademicRecord):string {
  const legacy='autores' in record;
  const authors=legacy?record.autores:[record.aluno1?.nome,record.aluno2?.nome].filter(Boolean) as string[];
  const advisor=legacy?record.orientador:record.orientador?.nome;
  const coadvisor=legacy?record.coorientador:record.coorientador?.nome;
  const board=legacy?record.examinadores:record.banca;
  const date=legacy?[record.dataDefesa,record.horaDefesa].filter(Boolean).join(' '):record.defesa?.startAt;
  const location=legacy?record.localDefesa:record.defesa?.local;
  const keywords=(legacy?record.palavrasChave:record.acervo?.palavrasChave||[]).filter(word=>String(word).trim()).slice(0,5);
  const summary=legacy?record.resumo:record.acervo?.resumoSintese;
  const field=(label:string,value:unknown)=>`- **${label}:** ${markdownText(value)}`;
  const readable=(value:string|undefined)=>value?value.charAt(0).toUpperCase()+value.slice(1).toLowerCase().replace(/_/g,' '):'';
  const defense=legacy?undefined:record.defesa;
  const history=defense?.reservationHistory||[];
  const historyLines=history.flatMap((entry,index)=>[
    `### Reserva anterior ${index+1}`,'',field('Revisão',entry.reservationRevision),
    field('Início da defesa',entry.startAt),field('Fim da defesa',entry.endAt),field('Local',entry.local),field('Local alternativo',entry.alternateLocation),
    field('Situação do local',readable(entry.localStatus)),field('Confirmação do local',entry.localConfirmedAt),
    field('Resposta à reserva',readable(entry.departmentResponse?.decision)),field('Data da resposta',entry.departmentResponse?.respondedAt),
    field('Reserva substituída em',entry.invalidatedAt),''
  ]);
  const request=defense?.reservationChangeRequest;
  return [
    `# Dados do processo — ${markdownText(record.protocolo)}`,'',
    field('Código',record.protocolo),field('Título',record.titulo),field('Autores',authors.join('; ')),
    field('Origem',legacy||record.legacyRecord?'Registro histórico':'Processo atual'),
    field('Situação',legacy?undefined:readable(record.status)),field('Etapa',legacy?undefined:readable(record.etapaAtual)),
    field('Cadastro em',legacy?undefined:record.createdAt),field('Atualização em',legacy?undefined:record.updatedAt),'',
    '## Orientação','',field('Orientador',advisor),field('Instituição do orientador',legacy?undefined:record.orientador?.instituicao),
    field('Coorientador',coadvisor),field('Instituição do coorientador',legacy?record.coorientadorInstituicao:record.coorientador?.instituicao),'',
    '## Banca examinadora','',...(board?.length?board.flatMap((person,index)=>[field(`Examinador ${index+1}`,person.nome),field(`Instituição do examinador ${index+1}`,person.instituicao)]):[field('Examinadores',undefined)]),'',
    '## Defesa e reserva','',field('Início da defesa',date),field('Fim da defesa',defense?.endAt),field('Formato da defesa',defense?.formato),
    field('Local da defesa',location),field('Local alternativo',defense?.alternateLocation),field('Revisão da reserva',defense?.reservationRevision),
    field('Situação do local',readable(defense?.localStatus)),field('Confirmação do local',defense?.localConfirmedAt),
    field('Resposta à reserva',readable(defense?.departmentResponse?.decision)),field('Data da resposta',defense?.departmentResponse?.respondedAt),'',
    '## Histórico de reservas','',...(historyLines.length?historyLines:['Não cadastrado','']),
    '## Solicitação de alteração da reserva','',...(request?[
      field('Situação',readable(request.status)),field('Solicitada em',request.requestedAt),field('Início solicitado',request.startAt),field('Fim solicitado',request.endAt),field('Local solicitado',request.local),field('Resolvida em',request.resolvedAt)
    ]:['Não cadastrado']),'',
    '## Resumo','',markdownText(summary),'','## Palavras-chave','',keywords.length?keywords.map(word=>`- ${markdownText(word)}`).join('\n'):'Não cadastrado',''
  ].join('\n');
}
