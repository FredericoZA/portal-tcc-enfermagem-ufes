/** Fixed identities reserved for the localhost test pack, never operational recipients. */
export const LOCAL_REVIEW_SCENARIOS=['Reserva sem comprovante','Reserva com comprovante','Convite disponível','Avaliação pendente','Ata aguardando assinatura','Entrega sem arquivos','Trabalho anexado, resumo ausente','Dois arquivos anexados','Somente resumo público solicitado','Publicação recusada','Termo aguardando assinaturas','Declaração aguardando assinatura'];
export const reviewStudentEmail=(index:number)=>`teste.qa58.${String(index+1).padStart(2,'0')}@edu.ufes.br`;
