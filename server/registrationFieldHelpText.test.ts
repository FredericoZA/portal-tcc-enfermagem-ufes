import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registrationFieldHelpText} from '../src/utils/registrationFieldHelpText';

test('título e instituições indicadas não repetem instrução antiga de asteriscos instalada no formulário',()=>{
  const original='Informe o nome completo da instituição. Para manter siglas e/ou acrônimos em maiúsculas, escreva *UFES*. Os asteriscos não aparecem nos documentos.';
  for(const key of ['TITULO','COORIENTADOR_INSTITUICAO','EXAMINADOR_2_INSTITUICAO','EXAMINADOR_3_INSTITUICAO']){
    assert.equal(registrationFieldHelpText(key,original),'Informe o nome completo da instituição.');
    assert.equal(registrationFieldHelpText(key,'Para siglas em caixa alta, use asteriscos.'),'');
  }
  assert.match(original,/\*UFES\*/,'o texto persistido não é modificado');
});

test('demais campos e instruções úteis permanecem intactos',()=>{
  const location='Para siglas em caixa alta, escreva *UFES*.';
  for(const key of ['DEFESA_LOCAL_PERSONALIZADO','ALUNO_1_NOME','ORIENTADOR_NOME','ORIENTADOR_INSTITUICAO'])assert.equal(registrationFieldHelpText(key,location),location);
  const useful='Informe o título completo. O asterisco indica que o campo é obrigatório.';
  assert.equal(registrationFieldHelpText('TITULO',useful),useful);
  assert.equal(registrationFieldHelpText('TITULO',undefined),'');
});

test('guia e editores compartilham instrução automática sem exigir marcas novas',()=>{
  const guide=readFileSync('src/components/PortalIllustratedGuide.tsx','utf8');
  assert.match(guide,/o Portal reconhece siglas automaticamente/);
  assert.doesNotMatch(guide,/escreva \*UFES\*|Os asteriscos não aparecem/);
  for(const file of ['src/components/ConfigurableRegistration.tsx','src/components/InlineProcessField.tsx']){
    assert.match(readFileSync(file,'utf8'),/INSTITUTION_ACRONYM_HELP/);
  }
});
