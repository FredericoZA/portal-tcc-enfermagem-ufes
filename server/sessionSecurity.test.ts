import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { attachPortalIdentity, getPortalIdentity, SESSION_ABSOLUTE_TTL_SECONDS } from './security/firebaseAuth';

const SECRET = 'session-test-secret-with-more-than-thirty-two-characters';

test('atividade renova apenas a validade da sessão e preserva identidade, idade do login e teto absoluto',async()=>{
 const previous={NODE_ENV:process.env.NODE_ENV,VERCEL:process.env.VERCEL,PORTAL_SESSION_SECRET:process.env.PORTAL_SESSION_SECRET};
 process.env.NODE_ENV='test';delete process.env.VERCEL;process.env.PORTAL_SESSION_SECRET=SECRET;
 try{
  const now=Math.floor(Date.now()/1000),issuedAt=now-3600;
  const req:any={headers:{cookie:`portal_tcc_session=${signedCookie({issuedAt,authTime:issuedAt,expiresAt:now+60})}`},method:'GET',originalUrl:'/api/me',path:'/api/me'};
  let header='';const res:any={setHeader(_key:string,value:string){header=value;}};
  await new Promise<void>(resolve=>attachPortalIdentity(req,res,()=>resolve()));
  const identity=getPortalIdentity(req)!;
  assert.equal(identity.authTime,issuedAt);assert.equal(identity.issuedAt,issuedAt);assert.equal(identity.email,'admin@example.edu');
  assert.ok(identity.expiresAt>now+60);assert.ok(identity.expiresAt<=issuedAt+SESSION_ABSOLUTE_TTL_SECONDS);assert.match(header,/HttpOnly/);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

function signedCookie(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const identity = {
    sessionId: 'session_identifier_1234567890',
    uid: 'email:admin@example.edu',
    email: 'admin@example.edu',
    emailVerified: true,
    authTime: now,
    issuedAt: now,
    expiresAt: now + 3600,
    isDemo: false,
    method: 'EMAIL_OTP',
    ...overrides
  };
  const payload = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
  const signature = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

async function attach(cookie: string, name = 'portal_tcc_session') {
  const req: any = { headers: { cookie: `${name}=${encodeURIComponent(cookie)}` }, method: 'POST', originalUrl: '/api/test', path: '/api/test' };
  const res: any = { setHeader() {} };
  await new Promise<void>((resolve) => attachPortalIdentity(req, res, () => resolve()));
  return req;
}

test('sessão além do teto absoluto é rejeitada mesmo com HMAC válido', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  const previousSecret = process.env.PORTAL_SESSION_SECRET;
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL;
  process.env.PORTAL_SESSION_SECRET = SECRET;
  try {
    const now = Math.floor(Date.now() / 1000);
    const issuedAt = now - SESSION_ABSOLUTE_TTL_SECONDS - 5;
    const req = await attach(signedCookie({ issuedAt, authTime: issuedAt, expiresAt: now + 3600 }));
    assert.equal(getPortalIdentity(req), null);
    assert.match(String(req.portalAuthError), /Sessão expirada/i);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
    if (previousSecret === undefined) delete process.env.PORTAL_SESSION_SECRET; else process.env.PORTAL_SESSION_SECRET = previousSecret;
  }
});

test('sessão assinada com uid incoerente é rejeitada', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  const previousSecret = process.env.PORTAL_SESSION_SECRET;
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL;
  process.env.PORTAL_SESSION_SECRET = SECRET;
  try {
    const req = await attach(signedCookie({ uid: 'email:outro@example.edu' }));
    assert.equal(getPortalIdentity(req), null);
    assert.match(String(req.portalAuthError), /Sessão inválida/i);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
    if (previousSecret === undefined) delete process.env.PORTAL_SESSION_SECRET; else process.env.PORTAL_SESSION_SECRET = previousSecret;
  }
});

test('sessão demo assinada nunca é aceita em runtime de produção', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  const previousSecret = process.env.PORTAL_SESSION_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.VERCEL;
  process.env.PORTAL_SESSION_SECRET = SECRET;
  try {
    const req = await attach(signedCookie({
      uid: 'demo:admin@example.edu',
      isDemo: true,
      method: 'DEVELOPMENT_DEMO'
    }), '__Host-portal_tcc_session');
    assert.equal(getPortalIdentity(req), null);
    assert.match(String(req.portalAuthError), /Sessão inválida/i);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
    if (previousSecret === undefined) delete process.env.PORTAL_SESSION_SECRET; else process.env.PORTAL_SESSION_SECRET = previousSecret;
  }
});
