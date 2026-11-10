import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function renderFooter(settings:unknown,isLoading:boolean):string {
  const exports:any={};
  const React={createElement:(type:unknown,props:any,...children:unknown[])=>({type,props:props||{},children}),useEffect:()=>{},useState:(initial:unknown)=>[typeof initial==='function'?(initial as ()=>unknown)():initial,()=>{}]};
  const modules:Record<string,unknown>={
    react:{...React,default:React,__esModule:true},'react-dom':{createPortal:()=>null},
    '../context/AuthContext':{useAuth:()=>({settings,isLoading})},
    '../utils/siteLayoutConfig':{loadSiteLayoutConfig:()=>({})},
    '../utils/installationProfile':{resolveInstallationProfile:()=>({})},
    '../theme/portalTheme':{PORTAL_THEME:{chrome:{},text:{}}},
    '../utils/commissionMemberOrder':{compareCommissionMemberNames:()=>0},
  };
  runInNewContext(ts.transpileModule(readFileSync('src/components/Footer.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:(name:string)=>modules[name]||{},sessionStorage:{getItem:()=>null}});
  const tree=exports.Footer({});
  const text=(node:any):string=>node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?[node.props?.name||'',...node.children.map(text)].join(' '):String(node);
  return text(tree);
}
test('footer distinguishes pending, failed settings and confirmed empty configuration',()=>{
  const loading=renderFooter(null,true);
  assert.equal(loading.split('Carregando informações…').length-1,2);
  assert.doesNotMatch(loading,/Não configurado|Não foi possível carregar/);
  const failed=renderFooter(null,false);
  assert.equal(failed.split('Não foi possível carregar as informações.').length-1,2);
  assert.doesNotMatch(failed,/Não configurado|Carregando informações/);
  const empty=renderFooter({},false);
  assert.equal(empty.split('Não configurado').length-1,2);
  assert.doesNotMatch(empty,/Não foi possível carregar|Carregando informações/);
  const configured=renderFooter({commissionPresidentName:'Presidente configurada',commissionMembers:[{name:'Integrante configurado'}]},false);
  assert.match(configured,/Presidente configurada/);assert.match(configured,/Integrante configurado/);
  assert.doesNotMatch(configured,/Não configurado|Não foi possível carregar|Carregando informações/);
});
