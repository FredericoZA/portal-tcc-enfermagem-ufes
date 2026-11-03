import test from 'node:test';
import assert from 'node:assert/strict';
import {accessListGoogleSheetsTemplate} from './googleWorkspace';

test('modelo Google converte XLSX formatado em Sheets privado e reutiliza o arquivo base',async()=>{
  const original=globalThis.fetch;let uploaded=0;let exists=false;
  globalThis.fetch=async(input,init)=>{
    const url=String(input);const decoded=decodeURIComponent(url).replace(/\+/g,' ');
    if(url.includes('/permissions?'))return Response.json({permissions:[]});
    if(decoded.includes("name = '00_SISTEMA'"))return Response.json({files:[{id:'system',name:'00_SISTEMA'}]});
    if(decoded.includes("name = 'MODELO_LISTA_ACESSO_V2'"))return Response.json({files:exists?[{id:'template',name:'MODELO_LISTA_ACESSO_V2'}]:[]});
    if(url.includes('/upload/drive/v3/files?')){
      const body=Buffer.from(init!.body as Buffer).toString('utf8');
      assert.match(body,/application\/vnd.google-apps.spreadsheet/);
      assert.match(body,/application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
      assert.match(body,/"parents":\["system"\]/);uploaded++;exists=true;
      return Response.json({id:'template',name:'MODELO_LISTA_ACESSO_V2'});
    }
    throw new Error(`Requisição inesperada: ${url}`);
  };
  try{
    const first=await accessListGoogleSheetsTemplate({accessToken:'test',rootFolderId:'root',content:Buffer.from('PK-workbook')});
    assert.equal(first.url,'https://docs.google.com/spreadsheets/d/template/copy');assert.equal(first.created,true);
    assert.equal((await accessListGoogleSheetsTemplate({accessToken:'test',rootFolderId:'root',content:Buffer.from('PK-workbook')})).created,false);
    assert.equal(uploaded,1);
  }finally{globalThis.fetch=original;}
});
