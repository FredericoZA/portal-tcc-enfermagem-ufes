import type {DocumentType,ProcessData,ProcessDocument} from '../types';

export const administrativeDocumentLabels: Record<DocumentType, {title:string; signer:string; pending:string; generated:string}> = {
 CONVITE: {title:'Carta-convite da banca',signer:'Não necessária',pending:'Ainda não gerada',generated:'Carta-convite gerada'},
 ATA: {title:'Ata',signer:'Orientador e examinadores',pending:'Ainda não gerada',generated:'Ata gerada'},
 TERMO: {title:'Termo de autorização e publicação',signer:'Orientador e autores',pending:'Ainda não gerado',generated:'Termo gerado'},
 DECLARACAO: {title:'Declaração de participação na banca',signer:'Presidência da comissão',pending:'Ainda não gerada',generated:'Declaração gerada'},
};

export function publicationDeclined(process:Pick<ProcessData,'acervo'>):boolean{
 const delivery=process.acervo;
 return Boolean(delivery?.submittedAt&&!delivery.publishFullWork&&!delivery.publishExpandedAbstract&&!delivery.publicationWithdrawnAt);
}
export function administrativeDocumentAvailability(process:Pick<ProcessData,'acervo'>,document:Pick<ProcessDocument,'type'|'status'|'driveDownloadUrl'|'versions'>,publicReadOnly=false):{publicationDeclined:boolean;available:boolean}{
 const declined=!publicReadOnly&&document.type==='TERMO'&&publicationDeclined(process);
 const version=document.versions?.find(item=>item.isCurrent)||document.versions?.[0];
 return {publicationDeclined:declined,available:!declined&&Boolean(document.driveDownloadUrl||version?.driveDownloadUrl)&&(document.status==='DISPONIVEL'||document.status==='ASSINADO')};
}
export function finalDeliveryMessage(process:Pick<ProcessData,'status'|'acervo'|'signatureProviderPreferences'> & {workflowPending?:boolean}):string{
 if(process.status==='CONCLUIDO')return 'Toda a documentação necessária foi entregue e o processo está concluído. Os documentos finais estão disponíveis em Documentos do processo.';
 const requested=Boolean(process.acervo?.publishFullWork||process.acervo?.publishExpandedAbstract);
 if(process.workflowPending)return 'Entrega salva. A geração ou o encaminhamento dos documentos está pendente; a comissão precisa resolver essa etapa. Acompanhe em Documentos do processo.';
 if(!requested)return 'Entrega salva, sem necessidade de assinatura do Termo de Autorização. Acompanhe a declaração em Documentos do processo.';
 return process.signatureProviderPreferences?.TERMO==='GOV_BR'
  ? 'Entrega salva. Em Documentos do processo, abra Gov.br no Termo de Autorização para baixar o PDF. O orientador deve devolver o mesmo arquivo com todas as assinaturas.'
  : 'Entrega salva. Em Documentos administrativos, abra o Termo de Autorização para solicitar a assinatura. Autores e orientador assinam pelo método escolhido.';
}
