import type {ProcessData,ProcessDocument} from '../types';
export function publicationDeclined(process:Pick<ProcessData,'acervo'>):boolean{
 const delivery=process.acervo;
 return Boolean(delivery?.submittedAt&&!delivery.publishFullWork&&!delivery.publishExpandedAbstract&&!delivery.publicationWithdrawnAt);
}
export function administrativeDocumentAvailability(process:Pick<ProcessData,'acervo'>,document:Pick<ProcessDocument,'type'|'status'>,publicReadOnly=false):{publicationDeclined:boolean;available:boolean}{
 const declined=!publicReadOnly&&document.type==='TERMO'&&publicationDeclined(process);
 return {publicationDeclined:declined,available:!declined&&(document.status==='DISPONIVEL'||document.status==='ASSINADO')};
}
export function finalDeliveryMessage(process:Pick<ProcessData,'status'|'acervo'|'signatureProviderPreferences'> & {workflowPending?:boolean}):string{
 if(process.status==='CONCLUIDO')return 'Toda a documentação necessária foi entregue e o processo está concluído. Os documentos finais estão disponíveis em Documentos do processo.';
 const requested=Boolean(process.acervo?.publishFullWork||process.acervo?.publishExpandedAbstract);
 if(process.workflowPending)return 'Entrega salva. A geração ou o encaminhamento dos documentos está pendente; a comissão precisa resolver essa etapa. Acompanhe em Documentos do processo.';
 if(!requested)return 'Entrega salva, sem necessidade de assinatura do Termo de Autorização. Acompanhe a declaração em Documentos do processo.';
 return process.signatureProviderPreferences?.TERMO==='GOV_BR'
  ? 'Entrega salva. Em Documentos do processo, abra Gov.br no Termo de Autorização para baixar o PDF. O orientador deve devolver o mesmo arquivo com todas as assinaturas.'
  : 'Entrega salva. Autores e orientador devem conferir e assinar o Termo de Autorização pelo e-mail da Asten. Acompanhem em Documentos do processo.';
}
