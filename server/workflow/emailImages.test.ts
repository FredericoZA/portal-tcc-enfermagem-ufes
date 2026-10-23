import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withEmailImages} from './emailImages';
test('imagem salva usa asset público absoluto e mantém instruções e HTML existentes',()=>{
  const value='data:image/png;base64,aW1hZ2U=';
  const studio:any={emailDesigns:{e:{heroImageUrl:value,logoUrl:'javascript:alert(1)'}}};
  const result=withEmailImages(studio,'e','<html><body><p>Orientações</p></body></html>','Texto','https://portal.example');
  assert.match(result!,new RegExp('https://portal.example/api/public/runtime-assets/'+createHash('sha256').update(value).digest('hex')));
  assert.match(result!,/<p>Orientações<\/p>/);assert.doesNotMatch(result!,/javascript:|base64/);assert.equal((result!.match(/<img/g)||[]).length,1);
  assert.equal(withEmailImages({},'e',undefined,'Texto','https://portal.example'),undefined);
  const safe=withEmailImages({emailDesigns:{e:{heroImageUrl:'/api/public/runtime-assets/'+ 'a'.repeat(64)}}} as any,'e',undefined,'<script>teste</script>','https://portal.example');
  assert.match(safe!,/&lt;script&gt;teste/);
});
