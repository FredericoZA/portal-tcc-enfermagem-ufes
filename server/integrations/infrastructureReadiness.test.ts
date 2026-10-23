import test from 'node:test';
import assert from 'node:assert/strict';
import {astenInfrastructureCheck,infrastructureReadyForProduction,type InfrastructureCheck} from './infrastructureReadiness';

const connected={configured:true,dispatchEnabled:true,callbackConfigured:true};
test('assinatura obrigatória exige conexão, despacho, callback e inbox durável',()=>{
  assert.equal(astenInfrastructureCheck(connected,true).status,'PASS');
  assert.equal(astenInfrastructureCheck(connected,false).status,'FAIL');
  for(const key of Object.keys(connected))assert.equal(astenInfrastructureCheck({...connected,[key]:false},true).status,'FAIL');
});
test('produção não passa com Asten ausente, bloqueada ou apenas callback configurado',()=>{
  const checks:InfrastructureCheck[]=['secret-store','google-oauth-security','supabase','supabase-transactional','google','asten-folders','vercel','models'].map(id=>({id,label:id,status:'PASS',message:''}));
  assert.equal(infrastructureReadyForProduction(checks,true),false);
  assert.equal(infrastructureReadyForProduction([...checks,astenInfrastructureCheck(connected,false)],true),false);
  assert.equal(infrastructureReadyForProduction([...checks,astenInfrastructureCheck(connected,true)],false),false);
  assert.equal(infrastructureReadyForProduction([...checks,astenInfrastructureCheck(connected,true)],true),true);
});
