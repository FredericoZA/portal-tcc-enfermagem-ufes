/** Original-only compatibility: missing app access may use the existing hash-verified byte route.
 * Consent/hash/ACL failures never downgrade to this compatibility response. */
export function publicDriveFailure(error:unknown){
 const failure=error as {driveStatus?:number;driveReason?:string};
 if(failure?.driveStatus===403&&failure.driveReason==='appNotAuthorizedToFile')return {status:200,body:{links:null,requiresDriveAuthorization:true}};
 return {status:409,body:{error:'Não foi possível confirmar o PDF público no Drive. A publicação permanece protegida até a revisão.',driveStatus:failure?.driveStatus,driveReason:failure?.driveReason}};
}

/** Issued public documents retain their verified Portal delivery if Google cannot serve a direct link. */
export function publicDocumentDriveFailure(error:unknown){
 const status=Number((error as {driveStatus?:number})?.driveStatus);
 if(Number.isInteger(status)&&status>=400&&status<=599)return {status:200,body:{links:null,requiresDriveAuthorization:status===403}};
 return publicDriveFailure(error);
}
