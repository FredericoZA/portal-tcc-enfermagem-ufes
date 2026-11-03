import test from 'node:test';
import assert from 'node:assert/strict';
import {consolidateProcessForms,RETIRED_PROCESS_FORM_IDS} from '../src/utils/processFormConsolidation';
import {evaluationQuestions} from '../src/utils/evaluationForm';
import {filterTemplateVariables} from './workflow/runtime';

test('consolida etapas nativas sem eliminar cadastro, campos de avaliação ou formulários personalizados',()=>{
 const source:any={formTemplates:[{id:'form-reserva-aluno',questions:[{fieldKey:'TITULO'}]},...Array.from(RETIRED_PROCESS_FORM_IDS).map(id=>({id,questions:[{id:'q',fieldKey:'OBSERVACAO',label:'Observação',fieldType:'text',availableToTemplates:false}]})),{id:'custom',questions:[]}],workflowStages:[{id:'stage',actions:[{type:'form',refId:'form-parecer-banca'},{type:'form',referenceId:'form-banca-orientador'},{type:'form',refId:'form-homologacao-coordenador'},{type:'doc',refId:'ata'},{type:'email',refId:'email'},{type:'form',refId:'custom'}]}],formDesigns:{'form-parecer-banca':{},'form-reserva-aluno':{}},matrixColumns:[]};
 const result=consolidateProcessForms(source);
 assert.deepEqual(result.formTemplates.map((form:any)=>form.id),['form-reserva-aluno','custom']);
 assert.deepEqual(result.workflowStages[0].actions.map((action:any)=>action.refId),['ata','email','custom']);
 assert.ok(evaluationQuestions(result).some(question=>question.fieldKey==='OBSERVACAO'));
 assert.deepEqual(filterTemplateVariables({OBSERVACAO:'Privado',TITULO:'Público'},result),{TITULO:'Público'});
 assert.deepEqual(consolidateProcessForms(result),result);
 assert.equal(source.formTemplates.length,5,'A revisão anterior deve permanecer intacta.');
});
test('campos já migrados prevalecem sobre configurações antigas restauradas',()=>{
 const result=consolidateProcessForms({processFieldSchemas:{evaluation:[{id:'current',fieldKey:'PARECER',label:'Parecer atual',fieldType:'textarea',required:true}]},formTemplates:[{id:'form-parecer-banca',questions:[{label:'Antigo'}]}]});
 assert.equal(result.processFieldSchemas?.evaluation[0].label,'Parecer atual');
 assert.equal(result.formTemplates.length,0);
});

test('preserva a imagem única do formulário sem restaurar brasão ou banner',()=>{
 const source:any={brandKit:{courseLogoUrl:'logo-global'},formDesigns:{'form-reserva-aluno':{templateId:'form-reserva-aluno',logoUrl:'logo',universityLogoUrl:'brasao',bannerImageUrl:'banner',submitLabel:'Enviar'}}};
 const result=consolidateProcessForms(source);
 assert.equal(result.formDesigns['form-reserva-aluno'].logoUrl,'logo');
 assert.equal(result.formDesigns['form-reserva-aluno'].universityLogoUrl,'');
 assert.equal(result.formDesigns['form-reserva-aluno'].bannerImageUrl,'');
 assert.equal(result.formDesigns['form-reserva-aluno'].submitLabel,'Enviar');
 assert.equal(result.brandKit.courseLogoUrl,'logo-global');
 assert.equal(source.formDesigns['form-reserva-aluno'].bannerImageUrl,'banner');
});
