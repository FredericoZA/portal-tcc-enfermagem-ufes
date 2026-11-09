import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/components/PortalErrorBoundary.tsx',import.meta.url),'utf8');

function fixture(blockedStorage=false){
 const storage=new Map<string,string>(),replaced:string[]=[];
 const location={href:'https://portal.example.invalid/process?tab=documents#ata',pathname:'/process',replace(url:string){replaced.push(url);this.href=url;this.pathname=new URL(url).pathname;},reload(){}};
 const window={location,sessionStorage:{getItem(key:string){if(blockedStorage)throw Error('Storage is blocked');return storage.get(key)??null;},setItem(key:string,value:string){if(blockedStorage)throw Error('Storage is blocked');storage.set(key,value);}}};
 return {storage,replaced,location,fail(commit:string,message='Failed to fetch dynamically imported module'){
  // Exercise the emitted component, including build-time constants, without adding browser/runtime hooks.
  const compiled=transformSync(source,{loader:'tsx',format:'cjs',target:'es2022',define:{'import.meta.env.VITE_APP_VERSION':JSON.stringify('1.0.79'),'import.meta.env.VITE_GIT_COMMIT':JSON.stringify(commit)}}).code;
  const module={exports:{}} as {exports:{PortalErrorBoundary?:any}};
  vm.runInNewContext(compiled,{module,exports:module.exports,require,window,URL,Error});
  const component=new module.exports.PortalErrorBoundary({children:null});
  component.state=module.exports.PortalErrorBoundary.getDerivedStateFromError();
  component.componentDidCatch(new Error(message),{});
  return renderToStaticMarkup(component.render());
 }};
}

test('lazy chunk recovery is bounded per source build even when package version remains unchanged',()=>{
 const f=fixture();
 f.fail('aaaaaaa');assert.equal(f.replaced.length,1);
 const withoutMarker=new URL(f.location.href);withoutMarker.searchParams.delete('__portal_reload');f.location.href=withoutMarker.toString();
 f.fail('aaaaaaa');assert.equal(f.replaced.length,1,'session storage also guards the same build after query removal');
 f.fail('bbbbbbb');assert.equal(f.replaced.length,2,'the prior deployment marker must not suppress the new build recovery');
 const fallback=f.fail('bbbbbbb');assert.equal(f.replaced.length,2);
 assert.match(fallback,/Não foi possível abrir esta tela/);assert.match(fallback,/Atualizar o portal/);
});

test('URL guard still bounds automatic recovery with blocked session storage and preserves the current destination',()=>{
 const f=fixture(true);
 f.fail('aaaaaaa');f.fail('aaaaaaa');assert.equal(f.replaced.length,1);
 f.fail('bbbbbbb');f.fail('bbbbbbb');assert.equal(f.replaced.length,2);
 const url=new URL(f.location.href);
 assert.equal(url.pathname,'/process');assert.equal(url.searchParams.get('tab'),'documents');assert.equal(url.hash,'#ata');
});

test('validation or mutation failures stay on the actionable fallback without any automatic reload',()=>{
 const f=fixture();
 for(const message of ['Não foi possível salvar o formulário.','A alteração não foi confirmada no banco durável.']){
  const fallback=f.fail('aaaaaaa',message);
  assert.match(fallback,/Atualizar o portal/);assert.equal(f.replaced.length,0);
 }
 assert.equal(f.storage.size,0);
});

test('missing build identity keeps the version fallback bounded instead of generating reload identities',()=>{
 const f=fixture();
 f.fail('');f.fail('');assert.equal(f.replaced.length,1);
 const blocked=fixture(true);blocked.fail('');blocked.fail('');assert.equal(blocked.replaced.length,1);
});
