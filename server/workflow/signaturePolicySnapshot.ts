import {createHash} from 'node:crypto';
import {validateSignatureRecipientRoles} from '../../src/utils/signatureRecipientRoles';
import type {SignaturePolicySnapshot,SignatureJob} from '../../src/types/signatures';
type SignableDocumentType='ATA'|'TERMO'|'DECLARACAO';
export function signaturePolicyDigest(snapshot:Omit<SignaturePolicySnapshot,'digest'>):string{return createHash('sha256').update(JSON.stringify({version:snapshot.version,configured:snapshot.configured,documentType:snapshot.documentType,templateId:snapshot.templateId,studioRevision:snapshot.studioRevision,roles:snapshot.roles,signers:snapshot.signers.map(({role,name,email,signingOrder})=>({role,name,email,signingOrder}))})).digest('hex');}
export function assertSignaturePolicySnapshot(type:SignableDocumentType,job:Pick<SignatureJob,'signers'|'signerPolicySnapshot'>):void{
 const snapshot=job.signerPolicySnapshot;if(!snapshot)return;
 const {digest,...body}=snapshot;
 validateSignatureRecipientRoles({type,signatureRecipientRoles:snapshot.roles});
 if(snapshot.version!==1||typeof snapshot.configured!=='boolean'||snapshot.documentType!==type||digest!==signaturePolicyDigest(body)||!snapshot.signers.length||type==='ATA'&&snapshot.signers.length>6||JSON.stringify(snapshot.signers.map(({role,name,email,signingOrder})=>({role,name,email,signingOrder})))!==JSON.stringify(job.signers.map(({role,name,email,signingOrder})=>({role,name,email,signingOrder}))))throw new Error('A política de signatários desta versão não corresponde ao documento preparado. Confira a versão original antes de continuar.');
}
