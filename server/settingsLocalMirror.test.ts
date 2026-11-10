import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {readSettingsLocalMirror,writeSettingsLocalMirror} from '../src/utils/settingsLocalMirror';

function storage(t: TestContext, value:unknown){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;});
}

test('storage bloqueado ou cheio não interrompe leitura e escrita de espelhos opcionais', t=>{
  storage(t,{getItem(){throw new DOMException('blocked','SecurityError');},setItem(){throw new DOMException('full','QuotaExceededError');}});
  assert.equal(readSettingsLocalMirror('portal_doc_templates'),null);
  assert.equal(writeSettingsLocalMirror('portal_doc_templates','new'),false);
});

test('quota esgotada preserva o conteúdo anterior e não declara recuperação salva',t=>{
  const values=new Map([['recovery','original']]);let writes=0;
  storage(t,{getItem:(key:string)=>values.get(key)||null,setItem(){writes++;throw new DOMException('full','QuotaExceededError');}});
  assert.equal(writeSettingsLocalMirror('recovery','updated'),false);
  assert.equal(values.get('recovery'),'original');assert.equal(writes,1);
});

test('espelho idêntico não é regravado a cada montagem da tela', t=>{
  const values=new Map<string,string>();let writes=0;
  storage(t,{getItem:(key:string)=>values.get(key)||null,setItem(key:string,value:string){writes++;values.set(key,value);}});
  for(let i=0;i<100;i++)assert.equal(writeSettingsLocalMirror('same','value'),true);
  assert.equal(writes,1);assert.equal(readSettingsLocalMirror('same'),'value');
});

test('inicializador real da matriz e efeitos reais de Configurações sobrevivem ao storage indisponível', t=>{
  storage(t,{getItem(){throw new DOMException('blocked','SecurityError');},setItem(){throw new DOMException('full','QuotaExceededError');}});
  const source=readFileSync('src/pages/ConfiguracoesPage.tsx','utf8');
  const start=source.indexOf('  const [matrixColumns, setMatrixColumns] = useState');
  const end=source.indexOf('  const [matrixRows,',start);
  assert.ok(start>0&&end>start);
  let mirrorWarning=false,engineUpdated=false;
  const context={readSettingsLocalMirror,writeSettingsLocalMirror,console,DEFAULT_MATRIX_COLUMNS:[{id:'DEFAULT'}],
    useState:(initializer:Function)=>[initializer(),()=>{}],
    persistLocalMirror:(key:string,value:string)=>{const ok=writeSettingsLocalMirror(key,value);if(!ok)mirrorWarning=true;return ok;},
    matrixColumns:[],docTemplates:[],updateRuntimeDocumentTemplates:()=>{engineUpdated=true;},
  };
  const script=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  assert.doesNotThrow(()=>vm.runInNewContext(script,context));
  const effectStart=source.indexOf("    persistLocalMirror('portal_doc_templates'");
  const effectEnd=source.indexOf('\n  }, [docTemplates]);',effectStart);
  assert.ok(effectStart>0&&effectEnd>effectStart);
  const effect=ts.transpileModule(source.slice(effectStart,effectEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  assert.doesNotThrow(()=>vm.runInNewContext(effect,context));
  assert.equal(mirrorWarning,true);assert.equal(engineUpdated,true,'a cópia local falha sem interromper a sincronização do motor de prévia');
  assert.doesNotMatch(source,/\blocalStorage\.(?:getItem|setItem)\(/);
  assert.match(source,/!persistLocalMirror\(key,JSON.stringify\(\[\.\.\.previous,emailTemplates\]\)\)\)return/,'não deduplicar sem preservar a recuperação');
});
