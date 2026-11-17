import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteIntegrationSecret } from './integrationSecrets';
import { getGoogleWorkspaceAccessToken, GoogleWorkspaceAuthorizationError, persistGoogleWorkspaceAuthorization } from './googleWorkspace';

test('missing or rejected OAuth grants expose a safe reconnect code, while temporary failures do not masquerade as reauthorization',async t=>{
  const keys=['NODE_ENV','PORTAL_ALLOW_LOCAL_SECRET_STORE','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  process.env.NODE_ENV='development';process.env.PORTAL_ALLOW_LOCAL_SECRET_STORE='true';
  for(const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])delete process.env[key];
  process.env.GOOGLE_OAUTH_CLIENT_ID='synthetic-client';process.env.GOOGLE_OAUTH_CLIENT_SECRET='synthetic-client-secret';
  t.after(async()=>{
    await deleteIntegrationSecret('google_workspace');
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  });
  await deleteIntegrationSecret('google_workspace');
  let status=400,error='invalid_grant',calls=0;
  t.mock.method(globalThis,'fetch',async(input:unknown)=>{
    assert.equal(String(input),'https://oauth2.googleapis.com/token');calls++;
    return Response.json({error,error_description:'private provider details must not reach the UI'},{status});
  });
  const needsReconnect=(value:unknown)=>value instanceof GoogleWorkspaceAuthorizationError&&value.code==='GOOGLE_REAUTHORIZATION_REQUIRED'&&!value.message.includes('private provider details');
  await assert.rejects(getGoogleWorkspaceAccessToken(),needsReconnect);
  assert.equal(calls,0);
  await persistGoogleWorkspaceAuthorization({email:'portal@example.invalid',refreshToken:'synthetic-refresh',scopes:['drive.file']});
  for(const rejected of [400,401,403]){
    status=rejected;
    await assert.rejects(getGoogleWorkspaceAccessToken(),needsReconnect);
  }
  status=503;error='temporarily_unavailable';
  await assert.rejects(getGoogleWorkspaceAccessToken(),value=>value instanceof Error&&!(value instanceof GoogleWorkspaceAuthorizationError)&&/HTTP 503/.test(value.message)&&!value.message.includes('private provider details'));
  assert.equal(calls,4);
});
