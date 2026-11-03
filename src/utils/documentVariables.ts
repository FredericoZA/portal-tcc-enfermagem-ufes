import {publicationAuthorizationVariables,PUBLICATION_AUTHORIZATION_VARIABLE_KEYS} from './publicationAuthorization';
import type {ProcessData} from '../types';
import {academicName,personPresentationVariables,PERSON_PRESENTATION_VARIABLE_KEYS} from './personPresentation';
export const DOCUMENT_CONTEXT_VARIABLE_KEYS=['TCC_CODIGO','TCC_TITULO','TCC_TITULO_ENTRE_ASPAS','TCC_TITULO_MAIUSCULO','TRABALHO_COMPLETO_NOME_ARQUIVO','TRABALHO_COMPLETO_VERSAO','RESUMO_EXPANDIDO_NOME_ARQUIVO','RESUMO_EXPANDIDO_VERSAO'];
export const DOCUMENT_VARIABLE_KEYS=[...PERSON_PRESENTATION_VARIABLE_KEYS,...DOCUMENT_CONTEXT_VARIABLE_KEYS,...PUBLICATION_AUTHORIZATION_VARIABLE_KEYS];
/** The same projection feeds previews, workflow and all four official documents. */
export function documentVariables(p:ProcessData):Record<string,string>{
 const title=p.titulo.trim(),people=personPresentationVariables(p),names=people.AUTORIA_NOMES;
 const bank=p.banca.map(person=>academicName(person,'abbreviated')).filter(Boolean).join(', ');
 const vars:Record<string,string>={...people,...publicationAuthorizationVariables(p),TCC_CODIGO:p.protocolo,TCC_TITULO:title,TITULO_TRABALHO:title,TCC_TITULO_ENTRE_ASPAS:`“${title}”`,TCC_TITULO_MAIUSCULO:title.toLocaleUpperCase('pt-BR'),
  ALUNOS_NOMES:names,CAMPO_01:names,CAMPO_02:title,CAMPO_03:people.ORIENTADOR_NOME_ABREVIADO,ORIENTADOR_NOME:people.ORIENTADOR_NOME_ABREVIADO,NOME_ORIENTADOR:people.ORIENTADOR_NOME_ABREVIADO,COORIENTADOR_NOME:people.COORIENTADOR_NOME_ABREVIADO,CAMPO_COORIENTADOR:people.COORIENTADOR_NOME_ABREVIADO,EXAMINADOR_2_NOME:people.EXAMINADOR_2_NOME_ABREVIADO,EXAMINADOR_3_NOME:people.EXAMINADOR_3_NOME_ABREVIADO,
  BANCA_NOMES:bank,CAMPO_06:bank,
  TRABALHO_COMPLETO_NOME_ARQUIVO:p.acervo?.trabalhoCompletoFileName||'',TRABALHO_COMPLETO_VERSAO:p.acervo?.trabalhoCompletoVersion?String(p.acervo.trabalhoCompletoVersion):'',RESUMO_EXPANDIDO_NOME_ARQUIVO:p.acervo?.resumoExpandidoFileName||'',RESUMO_EXPANDIDO_VERSAO:p.acervo?.resumoExpandidoVersion?String(p.acervo.resumoExpandidoVersion):''};
 return vars;
}
