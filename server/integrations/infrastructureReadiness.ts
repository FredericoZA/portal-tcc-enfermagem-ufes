export interface InfrastructureCheck {
  id:string;
  label:string;
  status:'PASS'|'FAIL'|'PENDING';
  message:string;
}

export function astenInfrastructureCheck(status:{configured:boolean;dispatchEnabled:boolean;callbackConfigured:boolean},inboxReady:boolean):InfrastructureCheck {
  const ready=status.configured&&status.dispatchEnabled&&status.callbackConfigured&&inboxReady;
  const message=!status.configured?'Conecte a conta Asten e selecione o repositório.':
    !status.callbackConfigured?'Configure o retorno HTTPS autenticado da Asten.':
    !inboxReady?'A fila privada de retornos não está disponível. Aplique a migração 202610140001_asten_webhook_inbox.sql e confira o acesso do servidor.':
    !status.dispatchEnabled?'Asten conectada, mas o envio está bloqueado na configuração do servidor.':
    'Conexão, envio, retorno HTTPS autenticado e fila privada disponíveis. O piloto de assinatura deve ser validado separadamente.';
  return{id:'asten',label:'Assinatura Asten e retorno automático',status:ready?'PASS':'FAIL',message};
}

/** Missing checks must fail closed, including the only supported signing provider. */
export function infrastructureReadyForProduction(checks:InfrastructureCheck[],vercelProduction:boolean):boolean {
  const required=['secret-store','google-oauth-security','supabase','supabase-transactional','google','asten','asten-folders','vercel','models'];
  return vercelProduction&&required.every(id=>checks.some(check=>check.id===id&&check.status==='PASS'))&&checks.every(check=>check.status==='PASS');
}
