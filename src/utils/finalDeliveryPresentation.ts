import type {ProcessData} from '../types';
export function publicationDeclined(process:Pick<ProcessData,'acervo'>):boolean{
 const delivery=process.acervo;
 return Boolean(delivery?.submittedAt&&!delivery.publishFullWork&&!delivery.publishExpandedAbstract&&!delivery.publicationWithdrawnAt);
}
export function finalDeliveryMessage(process:Pick<ProcessData,'status'|'acervo'|'signatureProviderPreferences'> & {workflowPending?:boolean}):string{
 if(process.status==='CONCLUIDO')return 'Toda a documentação necessária foi entregue e o processo está concluído. Os documentos finais estão disponíveis em Documentos do processo.';
 const requested=Boolean(process.acervo?.publishFullWork||process.acervo?.publishExpandedAbstract);
 let text='Sua documentação foi entregue e salva no processo. Não é necessário reenviar os arquivos. ';
 if(requested){
  text+='O próximo passo dos autores e do orientador é conferir e assinar o Termo de Autorização para os arquivos escolhidos para publicação. ';
  text+=process.signatureProviderPreferences?.TERMO==='GOV_BR'?'Acessem a opção Gov.br em Documentos do processo para devolver o PDF com todas as assinaturas. ':'A solicitação de assinatura é encaminhada pela Asten aos e-mails cadastrados dos autores e do orientador. ';
  text+='Depois que o Termo assinado for arquivado, o Portal gerará a declaração de participação na banca e a encaminhará para assinatura da presidência da comissão. ';
 }else{
  text+='Não foi autorizada a publicação do trabalho nem do resumo expandido. Essa escolha fica registrada no cartão do Termo, sem necessidade de assinatura. A próxima etapa é a geração da declaração de participação na banca e sua assinatura pela presidência da comissão. ';
 }
 if(process.workflowPending)text+='Há uma pendência na geração ou no encaminhamento dos documentos que a comissão precisa resolver. A entrega permanece salva. Acompanhe o andamento em Documentos do processo; se a solicitação de assinatura ainda não chegar, informe o protocolo à comissão.';
 else text+='Acompanhe as solicitações de assinatura no e-mail cadastrado e o andamento em Documentos do processo. A conclusão ocorrerá após o arquivamento da declaração assinada.';
 return text;
}
