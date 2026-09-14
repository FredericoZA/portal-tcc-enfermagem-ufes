import fs from 'node:fs';
const p='scripts/finalize-ux-signature.mjs';
let s=fs.readFileSync(p,'utf8');
for(const token of ['${signer.role}','${signer.email}','${signer.signingOrder}','${job.id}','${signerArtifactSuffix}']){
  s=s.replaceAll(token,`\\${token}`);
}
fs.writeFileSync(p,s);
console.log('Escapes internos do patch corrigidos.');
