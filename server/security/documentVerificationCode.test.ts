import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {documentVerificationCode} from './documentVerificationCode';
const input={secret:'test-verification-secret-'.repeat(3),installationId:'test',processId:'p1',documentType:'ATA',dataRevision:2,documentVersion:1};
test('primeira versão mantém o código já emitido, preservando verificação e regeneração',()=>{assert.equal(documentVerificationCode(input),createHmac('sha256',input.secret).update('test|p1|ATA|2').digest('base64url').slice(0,32));});
test('substituição após cancelamento tem código próprio e é estável entre tentativas',()=>{const v2=documentVerificationCode({...input,documentVersion:2});assert.notEqual(v2,documentVerificationCode(input));assert.equal(v2,documentVerificationCode({...input,documentVersion:2}));assert.notEqual(v2,documentVerificationCode({...input,documentVersion:3}));});
test('validação rejeita versão inválida e segredo ausente',()=>{assert.throws(()=>documentVerificationCode({...input,documentVersion:0}));assert.throws(()=>documentVerificationCode({...input,secret:''}));});
