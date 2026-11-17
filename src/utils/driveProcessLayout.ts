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

function evidenceObject(value:unknown):Record<string,unknown>|undefined {
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}

/** Only academic text from the explicit sheet schema; never stringify nested provenance. */
function evidenceText(value:unknown):string {
  if(typeof value!=='string'&&!(typeof value==='number'&&Number.isFinite(value)))return 'Não cadastrado';
  const text=String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'')
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?/gi,'[contato omitido]');
  return markdownText(text).replace(/\n/g,'\n  ');
}

function legacySpreadsheetMarkdown(record:LegacyAcademicRecord):string[] {
  const evidence=evidenceObject(record.provenance?.legacySpreadsheetEvidence);
  if(evidence?.schemaVersion!==1)return [];
  const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
  const field=(label:string,value:unknown)=>`- **${label}:** ${evidenceText(value)}`;
  const coordinates=(value:unknown)=>{
    const item=evidenceObject(value);
    return item&&Number.isSafeInteger(item.column)&&Number(item.column)>0&&typeof item.cell==='string'&&/^[A-Z]{1,3}[1-9]\d*$/.test(item.cell)?`${item.cell} (coluna ${item.column})`:undefined;
  };
  const source=(entry:Record<string,unknown>):string[]|undefined=>{
    const match=evidenceObject(entry.match),origin=evidenceObject(entry.source);
    if(!match||match.canonicalId!==record.id||match.sourceFingerprint!==record.sourceFingerprint||
      !origin||typeof origin.fileId!=='string'||!/^[\w-]{10,150}$/.test(origin.fileId)||typeof origin.sheet!=='string'||
      !Number.isSafeInteger(origin.row)||Number(origin.row)<1)return undefined;
    return [field('Arquivo de origem (ID)',origin.fileId),field('Aba de origem',origin.sheet),field('Linha de origem',origin.row)];
  };
  const cell=(value:unknown,allowed:(header:string)=>boolean,label?:string):string[]=>{
    const item=evidenceObject(value),location=coordinates(item);
    if(!item||typeof item.header!=='string'||!allowed(item.header)||!location||
      (typeof item.value!=='string'&&!(typeof item.value==='number'&&Number.isFinite(item.value))))return [];
    return [field(label||`Campo ${item.header} — valor informado na fonte`,item.value),field('Célula de origem',location)];
  };
  const roles={A:'Orientador (1)',B:'Examinador (2)',C:'Examinador (3)'} as const;
  const evaluations=list(evidence.evaluations).flatMap((value,index)=>{
    const entry=evidenceObject(value),origin=entry&&source(entry);if(!entry||!origin)return [];
    const groups=list(entry.groups).flatMap(value=>{
      const group=evidenceObject(value),key=group?.group;
      if(!group||(key!=='A'&&key!=='B'&&key!=='C'))return [];
      const evaluator=evidenceObject(group.evaluator),location=coordinates(evaluator);
      const evaluatorLines=evaluator?.roleHeader===roles[key]&&typeof evaluator.name==='string'
        ?[field('Função informada na fonte',evaluator.roleHeader),field('Avaliador informado na fonte',evaluator.name),...(location?[field('Célula do avaliador',location)]:[])]:[];
      return [`#### Grupo ${key}`,'',...evaluatorLines,
        ...list(group.grades).flatMap(grade=>cell(grade,header=>new RegExp(`^(?:[1-9]|10)${key}$`).test(header))),
        ...cell(group.reportedTotal,header=>header===`Total ${key}`,`Total ${key} informado na fonte`),''];
    });
    const summary=list(entry.reportedSummary).flatMap(value=>cell(value,header=>['Média ABC','Situação','Parecer'].includes(header),
      evidenceObject(value)?.header==='Parecer'?'Parecer informado na fonte':evidenceObject(value)?.header==='Situação'?'Situação informada na fonte':'Média ABC informada na fonte'));
    if(!groups.length&&!summary.length)return [];
    return [`### Avaliação histórica ${index+1}`,'',...origin,'',...groups,...summary,''];
  });
  const people=(value:unknown)=>list(value).flatMap(value=>{
    const person=evidenceObject(value);return person&&typeof person.nome==='string'?[`${person.nome}${typeof person.instituicao==='string'&&person.instituicao.trim()?` — ${person.instituicao}`:''}`]:[];
  }).join('; ');
  const conflicts=list(evidence.conflicts).flatMap((value,index)=>{
    const entry=evidenceObject(value),origin=entry&&source(entry);
    if(!entry||!origin||entry.status!=='PRESERVE_SOURCE_ASSERTION_DO_NOT_OVERWRITE_CANONICAL')return [];
    const assertions=list(entry.assertions).flatMap(value=>{
      const assertion=evidenceObject(value),path=assertion&&list(assertion.fieldPath);
      if(!assertion||!path||path.length!==1||!['orientador','examinadores'].includes(String(path[0])))return [];
      const board=path[0]==='examinadores';
      const columns=list(assertion.sourceColumns).flatMap(value=>{
        const column=evidenceObject(value),location=coordinates(column);
        return column&&location&&(Object.values(roles) as readonly unknown[]).includes(column.header)?[field(`Coluna da fonte — ${column.header}`,location)]:[];
      });
      return [field('Campo divergente',board?'Banca examinadora (examinadores)':'Orientador (orientador)'),
        field('Valor atual no Portal',board?people(record.examinadores):record.orientador),
        field('Valor cadastrado na revisão da fonte',board?people(assertion.canonicalValueAtReview):assertion.canonicalValueAtReview),
        field('Valor informado na fonte',board?people(assertion.reportedValue):assertion.reportedValue),
        ...columns,field('Motivo registrado na revisão',assertion.reason),''];
    });
    return assertions.length?[`### Divergência preservada ${index+1}`,'',...origin,'',...assertions]:[];
  });
  return [
    ...(evaluations.length?['','## Avaliações históricas da fonte','',
      'Notas, totais, média, situação e parecer são valores informados na fonte histórica, preservados sem recálculo ou alteração da decisão acadêmica atual.','',...evaluations]:[]),
    ...(conflicts.length?['','## Divergências preservadas','',
      'As afirmações divergentes da fonte permanecem identificadas abaixo. Os valores atuais do Portal foram preservados.','',...conflicts]:[])
  ];
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
    '## Resumo','',markdownText(summary),'','## Palavras-chave','',keywords.length?keywords.map(word=>`- ${markdownText(word)}`).join('\n'):'Não cadastrado','',
    ...(legacy?legacySpreadsheetMarkdown(record):[])
  ].join('\n');
}
