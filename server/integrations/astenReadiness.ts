/** Read-only readiness checks. Never renders a PDF or creates an envelope. */
export async function inspectAstenDelivery(ports:{status:()=>Promise<{dispatchEnabled:boolean;securityMessage:string}>;inbox:()=>Promise<boolean>;folder:()=>Promise<unknown>;google:()=>Promise<{connected:boolean}>;hasDriveRoot:boolean}):Promise<{ready:boolean;reason:string}>{
 try{
  const status=await ports.status();if(!status.dispatchEnabled)return {ready:false,reason:status.securityMessage||'O envio Asten está desativado.'};
  if(!await ports.inbox())return {ready:false,reason:'A fila de retornos Asten não está disponível. Confira a integração antes de enviar.'};
  try{await ports.folder();}catch(error){
   const message=error instanceof Error?error.message:'Falha ao consultar a pasta.';
   if(/acesso não autorizado|unauthori[sz]ed|\b401\b|\b403\b/i.test(message))return {ready:false,reason:'Acesso não autorizado pela Asten. Reconecte a conta em Configurações → Integrações e Plataforma e confira a permissão para o repositório e a pasta da declaração.'};
   return {ready:false,reason:`Destino Asten da declaração: ${message}`};
  }
  if(!ports.hasDriveRoot)return {ready:false,reason:'Configure a pasta raiz do Google Drive antes de gerar a declaração.'};
  if(!(await ports.google()).connected)return {ready:false,reason:'Autorize o Google Workspace para gerar e arquivar a declaração antes de enviá-la à Asten.'};
  return {ready:true,reason:'Integrações prontas para gerar o documento e encaminhar à Asten.'};
 }catch(error){return {ready:false,reason:error instanceof Error?error.message:'Não foi possível conferir as integrações da declaração.'};}
}
