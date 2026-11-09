import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { uploadProcessFormPdf } from './googleDriveArchive';
import { DRIVE_FOLDER_NAMES } from './googleWorkspace';
import { PORTAL_DRIVE_STRUCTURE } from '../../src/services/googleDriveOrganizer';

test('catálogo institucional mantém tipos documentais e não cria pasta de declaração de comparecimento',()=>{
  assert.equal(DRIVE_FOLDER_NAMES.modelTypes.COMPROVANTE_RESERVA,'06_COMPROVANTE_RESERVA');
  assert.equal(DRIVE_FOLDER_NAMES.modelTypes.INSTRUMENTO_AVALIACAO_LEGADO,'05_INSTRUMENTO_AVALIACAO_LEGADO');
  assert.ok(PORTAL_DRIVE_STRUCTURE.modelChildren.includes('06_COMPROVANTE_RESERVA'));
  assert.equal(Object.values(DRIVE_FOLDER_NAMES.modelTypes).some(item=>item.includes('COMPARECIMENTO')),false);
  const workspace=readFileSync(new URL('./googleWorkspace.ts',import.meta.url),'utf8');
  const organizer=readFileSync(new URL('../../src/services/googleDriveOrganizer.ts',import.meta.url),'utf8');
  assert.match(workspace,/COMPROVANTE_RESERVA'.*includes\(type\)/);
  assert.match(organizer,/06_COMPROVANTE_RESERVA.*includes\(name\)/);
});

test('comprovante é arquivado uma vez em DOCUMENTOS/06_COMPROVANTE_RESERVA/02_GERADOS, sem assinatura',async()=>{
  const priorFetch=globalThis.fetch;
  const pdf=Buffer.from('%PDF-1.4\nfixture-receipt\n');
  const created:string[]=[];
  let fileUploads=0;
  const directories=new Map<string,string>();
  try{
    globalThis.fetch=async(input,init)=>{
      const url=new URL(String(input));
      if(url.pathname.endsWith('/permissions')) return Response.json({permissions:[{type:'user',role:'owner'}]});
      if(url.pathname==='/drive/v3/files' && init?.method==='POST'){
        const body=JSON.parse(String(init.body)) as {name:string};
        created.push(body.name);
        return Response.json({id:body.name,name:body.name});
      }
      if(url.pathname==='/drive/v3/files'){
        const query=String(url.searchParams.get('q')||'');
        return Response.json({files:[]});
      }
      if(url.pathname==='/upload/drive/v3/files'&&init?.method==='POST'){
        fileUploads++;
        const raw=String(init.body) || '';
        const buf=init.body as Buffer;
        assert.match(buf.toString('utf8'),/"formType":"CONFIRMACAO_LOCAL"/);
        assert.match(buf.toString('utf8'),/"portalProcessId":"process-fixture"/);
        assert.match(buf.toString('utf8'),/"sha256":"[0-9a-f]{64}"/);
        return Response.json({id:'receipt-fixture',name:'receipt-fixture.pdf'});
      }
      throw new Error('Unexpected Google API request '+url.pathname);
    };
    const result=await uploadProcessFormPdf({
      accessToken:'fixture',processFolderId:'process-root',rootFolderId:'root-institution',
      processId:'process-fixture',protocol:'TCC-2026-1',studentNames:['Teste'],
      formType:'CONFIRMACAO_LOCAL',version:4,pdf,sha256:createHash('sha256').update(pdf).digest('hex'),
    });
    assert.equal(result.id,'receipt-fixture');
    assert.deepEqual(created,['01_DOCUMENTOS','06_COMPROVANTE_RESERVA','02_GERADOS']);
    assert.equal(fileUploads,1);
    assert.equal(created.includes('03_ASSINADOS'),false);
    assert.equal(created.includes('00_FORMULARIOS'),false);
  }finally{globalThis.fetch=priorFetch;}
});

test('contrato visual não exibe caixa de título genérico em Configurações',()=>{
  const app=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8');
  const page=readFileSync(new URL('../../src/pages/ConfiguracoesPage.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(app,/Configurações & Modelos de Arquivos/);
  assert.doesNotMatch(page,/Configurações do Portal/i);
  assert.match(page,/portal-settings-hub/);
});
