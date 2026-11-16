interface OAuthActorPolicy {
  state: { email?: string; bootstrap: boolean; exp: number };
  masterEmail: string;
  sessionValidAfter?: number;
  identityEmail?: string;
  administrator: boolean;
  recentAuthentication: boolean;
}

/** OAuth authorizes an integration; it must never grant or restore ownership. */
export function assertCurrentGoogleOAuthActor(input: OAuthActorPolicy): string {
  const email = String(input.state.email || '').trim().toLowerCase();
  const master = String(input.masterEmail || '').trim().toLowerCase();
  const issuedAt = Math.floor((input.state.exp - 10 * 60_000) / 1000);
  if (!email || issuedAt < Number(input.sessionValidAfter || 0)) {
    throw new Error('Esta autorização Google foi revogada. Inicie uma nova conexão.');
  }
  if (input.state.bootstrap) {
    if (!master || email !== master) throw new Error('Somente o Master atual pode iniciar a conexão Google.');
  } else if (email !== String(input.identityEmail || '').trim().toLowerCase() ||
             !input.administrator || !input.recentAuthentication) {
    throw new Error('Entre novamente como administrador e inicie uma nova conexão Google.');
  }
  return email;
}


/** Google returns a Gmail mailbox's primary address, while Portal roles retain the exact login alias. */
export function googleAccountMatchesAuthorizedActor(accountEmail:string,actorEmail:string):boolean {
  const account=accountEmail.trim().toLowerCase(),actor=actorEmail.trim().toLowerCase();
  if(!account||!actor)return false;
  if(account===actor)return true;
  const accountParts=account.split('@'),actorParts=actor.split('@');
  return accountParts.length===2&&actorParts.length===2&&accountParts[0].length>0&&actorParts[0].length>0&&accountParts[1]==='gmail.com'&&actorParts[1]==='gmail.com'
    &&!accountParts[0].includes('+')&&actorParts[0].includes('+')&&actorParts[0].split('+')[0]===accountParts[0];
}
