import type {ProcessData} from '../types';
/** Authorization follows persisted, independent choices; an attachment alone gives no permission. */
export function publicationAuthorizationVariables(p:Pick<ProcessData,'acervo'>):Record<string,string>{
 const work=p.acervo?.publishFullWork===true,abstract=p.acervo?.publishExpandedAbstract===true;
 const line=(allowed:boolean,label:string)=>`${allowed?'☒':'☐'} ${label} — ${allowed?'publicação autorizada':'publicação não autorizada'}.`;
 return {
  PUBLICACAO_TRABALHO_MARCA:work?'☒':'☐',PUBLICACAO_RESUMO_MARCA:abstract?'☒':'☐',
  AUTORIZACAO_PUBLICACAO_ITENS:[line(work,'Trabalho de Conclusão de Curso (monografia completa)'),line(abstract,'Resumo expandido do artigo produzido')].join('\n')
 };
}
export const PUBLICATION_AUTHORIZATION_VARIABLE_KEYS=['PUBLICACAO_TRABALHO_MARCA','PUBLICACAO_RESUMO_MARCA','AUTORIZACAO_PUBLICACAO_ITENS'];
