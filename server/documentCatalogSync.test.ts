import test from 'node:test';
import assert from 'node:assert/strict';
import {syncCatalogTemplates,syncCatalogColumns} from '../src/utils/documentCatalogSync';
import {mergeStudioDraft} from '../src/utils/studioDraftMerge';
const catalog={ATA:{label:'Ata',driveFileId:'new-file',fileName:'ata.docx',uploadedAt:'2026-10-25',variables:['<<TITULO>>']},__capabilities:{existingModelLinkImportEnabled:true}};
test('catalog read changes the baseline without creating a user edit',()=>{
 const base={docTemplates:[{id:'ata',type:'ATA',driveFileId:'old-file',description:'Minha descrição',fields:['custom']}],matrixColumns:[] as any[]};
 const sync=(value:typeof base)=>({...value,docTemplates:syncCatalogTemplates(value.docTemplates,catalog),matrixColumns:syncCatalogColumns(value.matrixColumns,catalog)});
 assert.deepEqual(sync(base),sync(structuredClone(base)));
 assert.equal(sync(base).docTemplates[0].driveFileId,'new-file');assert.deepEqual(sync(base).docTemplates[0].fields,['custom']);assert.equal(sync(base).matrixColumns.length,1);
 assert.equal(syncCatalogColumns(sync(base).matrixColumns,catalog).length,1);
 assert.equal(base.docTemplates[0].driveFileId,'old-file');
});
test('catalog refresh preserves unsaved user fields and independent remote edits',()=>{
 const base={docTemplates:[{id:'ata',type:'ATA',driveFileId:'old-file',description:'Base',fields:['base']}],matrixColumns:[] as any[]};
 const local=structuredClone(base);local.docTemplates[0].description='Edição local';
 const syncedBase={...base,docTemplates:syncCatalogTemplates(base.docTemplates,catalog),matrixColumns:syncCatalogColumns(base.matrixColumns,catalog)};
 const syncedLocal={...local,docTemplates:syncCatalogTemplates(local.docTemplates,catalog),matrixColumns:syncCatalogColumns(local.matrixColumns,catalog)};
 const remote=structuredClone(syncedBase);remote.docTemplates[0].fields=['remote'];
 const merged=mergeStudioDraft(syncedBase,syncedLocal,remote);
 assert.equal(merged.docTemplates[0].description,'Edição local');assert.deepEqual(merged.docTemplates[0].fields,['remote']);assert.equal(merged.docTemplates[0].driveFileId,'new-file');
});
