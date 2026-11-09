import {test} from 'node:test';
import assert from 'node:assert/strict';
import {academicPeriodHelpText,academicPeriodOptions,ACADEMIC_PERIOD_FIELD} from '../src/utils/academicPeriod';
import {registrationQuestions} from '../src/utils/operationalConfig';

test('opções acompanham o ano do calendário, com dois semestres por ano',()=>{
 for(const year of [2026,2027]){
  const now=new Date(`${year}-06-10T12:00:00Z`);
  assert.deepEqual(academicPeriodOptions(undefined,now),['Não informado',`${year-1}-1`,`${year-1}-2`,`${year}-1`,`${year}-2`,`${year+1}-1`,`${year+1}-2`]);
  const help=academicPeriodHelpText(now);
  assert.ok(help.includes(`por exemplo, ${year}.1.`));
  assert.ok(!help.includes('As opções incluem'));
  assert.ok(!help.includes(`${year}.2`));
 }
});
test('campo instalado antigo recebe a orientação atual sem alterar a definição persistida',()=>{
 const legacy={revision:1,formTemplates:[{id:'form-reserva-aluno',questions:[{id:'period',fieldKey:ACADEMIC_PERIOD_FIELD,label:'Para fins estatísticos, período antigo',helpText:'As opções incluem o ano anterior, o atual e o seguinte.',section:'Trabalho',fieldType:'select',required:true,options:['2026-1']}]}]} as any;
 const before=JSON.stringify(legacy);
 const field=registrationQuestions(legacy).find(q=>q.fieldKey===ACADEMIC_PERIOD_FIELD)!;
 assert.equal(field.label,'A qual período acadêmico esta apresentação se refere?');
 assert.equal(field.required,false);
 assert.ok(field.helpText?.includes('Se não souber, escolha Não informado.'));
 assert.ok(field.helpText?.includes('O campo é opcional e não altera a data da defesa ou as etapas do processo.'));
 assert.ok(!field.helpText?.includes('As opções incluem'));
 assert.equal(field.options?.length,7);
 assert.equal(JSON.stringify(legacy),before);
});
