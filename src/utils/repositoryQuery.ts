import type {ProcessData} from '../types';
import {formatStudentsString,timestampInSaoPauloDateRange} from './formatters';
import {institutionSearchText} from './institutionName';

/** Query only the public projection. A date interval requires an observed defense date. */
export function matchesRepositoryQuery(process:ProcessData,input:{search:string;startDate:string;endDate:string}):boolean{
 const term=input.search.toLocaleLowerCase('pt-BR').trim();
 const institutions=[process.orientador,process.coorientador,...(process.banca||[])].map(person=>institutionSearchText(person?.instituicao||'')).join(' ');
 const institutionTerm=term.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const values=[process.titulo,process.protocolo,formatStudentsString(process.aluno1,process.aluno2),process.orientador?.nome,process.coorientador?.nome,process.defesa?.local,...(process.acervo?.palavrasChave||[]),...(process.banca||[]).map(person=>person.nome)];
 const matchText=!term||values.some(value=>(value||'').toLocaleLowerCase('pt-BR').includes(term))||institutions.includes(institutionTerm);
 if(!matchText)return false;
 return matchesDefenseDateRange(process,input.startDate,input.endDate);
}

/** Both repository and private process lists use the same observed calendar day. */
export function matchesDefenseDateRange(process:Pick<ProcessData,'defesa'|'legacyRecord'>,startDate:string,endDate:string):boolean{
 if(!startDate&&!endDate)return true;
 const day=(process.defesa?.startAt||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const parsed=Date.parse(day+'T00:00:00Z');
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return false;
 if(!process.legacyRecord&&process.defesa.startAt!==day)return timestampInSaoPauloDateRange(process.defesa.startAt,startDate,endDate);
 return (!startDate||day>=startDate)&&(!endDate||day<=endDate);
}
