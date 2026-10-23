import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {apiClient} from '../src/services/apiClient';
import {MAX_PUBLIC_VERIFICATION_PDF_BYTES,verifyPublicPdfLocally} from '../src/utils/publicPdfVerification';
import {createSupabaseStagedUpload} from './integrations/supabaseStorageStaging';

const originalBytes='%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF';
const originalSha256=createHash('sha256').update(originalBytes).digest('hex');
const originalFile=()=>new File([originalBytes],'ata-assinada.pdf',{type:'application/pdf'});
const metadata=()=>({valid:true,status:'VALID',sha256:originalSha256});

async function withCrypto(value:unknown,operation:()=>Promise<void>){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{value,configurable:true});
  try{await operation();}finally{if(previous)Object.defineProperty(globalThis,'crypto',previous);else Reflect.deleteProperty(globalThis,'crypto');}
}

test('cliente verifica bytes originais com um GET de metadados e nenhum upload, POST ou Storage',async()=>{
  const previousFetch=globalThis.fetch;
  const calls:Array<{url:string;method:string;body:unknown}>=[];
  try{
    globalThis.fetch=async(url,options)=>{
      calls.push({url:String(url),method:options?.method||'GET',body:options?.body});
      assert.equal(String(url),'/api/public/verification/codigo%2Fcom%20espaco');
      assert.equal(options?.method||'GET','GET');
      assert.equal(options?.body,undefined);
      return Response.json(metadata());
    };
    await withCrypto(webcrypto,async()=>{
      assert.deepEqual(await apiClient.checkVerificationPdfFile('codigo/com espaco',originalFile()),{valid:true,status:'MATCH',sha256:originalSha256});
    });
    assert.equal(calls.length,1);
  }finally{globalThis.fetch=previousFetch;}
});

test('alterar um byte do PDF produz MISMATCH com o hash do arquivo local',async()=>{
  await withCrypto(webcrypto,async()=>{
    let metadataReads=0;
    const altered=originalBytes.replace('Catalog','CatAlog');
    const result=await verifyPublicPdfLocally(new File([altered],'ata.pdf'),async()=>{metadataReads++;return metadata();});
    assert.deepEqual(result,{valid:false,status:'MISMATCH',sha256:createHash('sha256').update(altered).digest('hex')});
    assert.equal(metadataReads,1);
  });
});

test('arquivo vazio, maior que 50 MB e conteúdo não PDF são recusados antes de hash ou consulta',async()=>{
  let digests=0;
  let metadataReads=0;
  await withCrypto({subtle:{digest:async()=>{digests++;throw new Error('não deveria calcular');}}},async()=>{
    const read=async()=>{metadataReads++;return metadata();};
    await assert.rejects(verifyPublicPdfLocally(new File([],'vazio.pdf'),read),/até 50 MB/);
    const oversized={size:MAX_PUBLIC_VERIFICATION_PDF_BYTES+1,slice:()=>{throw new Error('não deveria ler');}} as unknown as Blob;
    await assert.rejects(verifyPublicPdfLocally(oversized,read),/até 50 MB/);
    await assert.rejects(verifyPublicPdfLocally(new File(['<html>falso</html>'],'falso.pdf',{type:'application/pdf'}),read),/assinatura PDF válida/);
    assert.equal(digests,0);
    assert.equal(metadataReads,0);
  });
});

test('código revogado ou checksum ausente/inválido não calcula hash nem confirma autenticidade',async()=>{
  let digests=0;
  await withCrypto({subtle:{digest:async()=>{digests++;throw new Error('não deveria calcular');}}},async()=>{
    for(const response of [{valid:false,status:'NOT_FOUND',sha256:originalSha256},{valid:true,status:'REVOKED',sha256:originalSha256},{valid:true,status:'VALID'},{valid:true,status:'VALID',sha256:'a'.repeat(63)}]){
      await assert.rejects(verifyPublicPdfLocally(originalFile(),async()=>response),/documento assinado disponível/);
    }
    assert.equal(digests,0);
  });
});

test('WebCrypto ausente ou indisponível falha sem recorrer a upload no servidor',async()=>{
  let metadataReads=0;
  const read=async()=>{metadataReads++;return metadata();};
  await withCrypto(undefined,async()=>{
    await assert.rejects(verifyPublicPdfLocally(originalFile(),read),/verificação criptográfica exigida/);
    assert.equal(metadataReads,0);
  });
  const previousFetch=globalThis.fetch;
  let calls=0;
  try{
    globalThis.fetch=async(url,options)=>{
      calls++;
      assert.equal(String(url),'/api/public/verification/codigo');
      assert.equal(options?.method||'GET','GET');
      return Response.json(metadata());
    };
    await withCrypto({subtle:{digest:async()=>{throw new Error('bloqueado');}}},async()=>{
      await assert.rejects(apiClient.checkVerificationPdfFile('codigo',originalFile()),/Nenhum arquivo foi enviado/);
    });
    assert.equal(calls,1);
  }finally{globalThis.fetch=previousFetch;}
});

test('staging público de verificação é recusado antes de alocar ticket, bucket ou emitir URL',async()=>{
  const previousFetch=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests++;throw new Error('não deve alcançar armazenamento');};
  try{
    await assert.rejects(createSupabaseStagedUpload({purpose:'VERIFICATION_PDF',requesterBinding:'public:codigo',verificationCode:'codigo',fileName:'ata.pdf',mimeType:'application/pdf',size:originalFile().size,sha256:originalSha256}),/envio público.*desativado/);
    assert.equal(requests,0);
  }finally{globalThis.fetch=previousFetch;}
});
