/** Isolated HTTP contract fixture: no real provider requests or credentials. */
import {saveIntegrationSecret} from '../../server/integrations/integrationSecrets';
if(process.env.NODE_ENV!=='development'||process.env.VERCEL||process.env.PORTAL_PERSISTENCE_PROVIDER!=='local_file'||process.env.PORTAL_TEST_DOCUMENT_RENDERER!=='true')throw new Error('Preload disponível somente no teste local isolado.');
process.env.PORTAL_ALLOW_LOCAL_SECRET_STORE='true';
process.env.PORTAL_PUBLIC_URL='https://portal-fixture.invalid';
const mapping={ATA:11,TERMO:12,DECLARACAO:13};
await saveIntegrationSecret('asten','token-ficticio-exclusivo-do-teste',{identifier:'3',repositoryId:42,validatedContractVersion:2});
await saveIntegrationSecret('asten_document_folders',JSON.stringify({version:1,portalOrigin:process.env.PORTAL_PUBLIC_URL,repositoryId:42,identifier:'3',mapping}),{validatedContractVersion:1,portalOrigin:process.env.PORTAL_PUBLIC_URL,repositoryId:42,identifier:'3'});
globalThis.fetch=async(input,init)=>{
 const url=String(input);if(!url.startsWith('https://plataforma.astenassinatura.com.br/api/'))throw new Error('Rede externa bloqueada no contrato local.');
 const service=url.split('/').at(-1);const {params}=JSON.parse(String(init?.body));
 if(service==='getPastasDoRepositorio')return Response.json({response:Object.values(mapping).map(id=>({id,nome:`Pasta ${id}`,Repositorio:{id:42}}))});
 if(service==='getDadosPasta')return Response.json({response:{id:params.idPasta,nome:'Pasta de teste',Repositorio:{id:42,Usuario:{id:'3'}}}});
 throw new Error(`Contrato não permite serviço externo ${service}`);
};
