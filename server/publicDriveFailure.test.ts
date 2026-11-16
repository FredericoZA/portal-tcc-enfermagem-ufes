import test from 'node:test';import assert from 'node:assert/strict';import {publicDriveFailure} from './publicDriveFailure';
import {getGoogleWorkspaceScopes} from './integrations/googleWorkspace';
test('only missing Google app access enables the existing independently verified original byte route',()=>{
 assert.deepEqual(publicDriveFailure({driveStatus:403,driveReason:'appNotAuthorizedToFile'}),{status:200,body:{links:null,requiresDriveAuthorization:true}});
 for(const error of [new Error('Hash mismatch'),{driveStatus:403,driveReason:'insufficientFilePermissions'},{driveStatus:404,driveReason:'notFound'},{driveStatus:500}]){const result=publicDriveFailure(error);assert.equal(result.status,409);assert.ok(!('links' in result.body));}
});
test('full Drive management scope remains disabled unless explicitly configured',t=>{
 const prior=process.env.GOOGLE_MANAGE_EXISTING_DRIVE_FILES;t.after(()=>{if(prior===undefined)delete process.env.GOOGLE_MANAGE_EXISTING_DRIVE_FILES;else process.env.GOOGLE_MANAGE_EXISTING_DRIVE_FILES=prior;});
 delete process.env.GOOGLE_MANAGE_EXISTING_DRIVE_FILES;assert.ok(!getGoogleWorkspaceScopes().some(scope=>scope==='https://www.googleapis.com/auth/drive'));
 process.env.GOOGLE_MANAGE_EXISTING_DRIVE_FILES='false';assert.ok(!getGoogleWorkspaceScopes().some(scope=>scope==='https://www.googleapis.com/auth/drive'));
 process.env.GOOGLE_MANAGE_EXISTING_DRIVE_FILES='true';assert.ok(getGoogleWorkspaceScopes().some(scope=>scope==='https://www.googleapis.com/auth/drive'));assert.ok(getGoogleWorkspaceScopes().some(scope=>scope==='https://www.googleapis.com/auth/drive.file'));
});

test('issued administrative documents keep safe byte delivery on provider refusal without weakening academic failures',async()=>{
 const {publicDocumentDriveFailure}=await import('./publicDriveFailure');
 assert.deepEqual(publicDocumentDriveFailure({driveStatus:403,driveReason:'insufficientFilePermissions'}),{status:200,body:{links:null,requiresDriveAuthorization:true}});
 assert.equal(publicDocumentDriveFailure(Error('hash changed')).status,409);
 assert.equal(publicDocumentDriveFailure(Error('credencial de acesso pessoal')).status,409);
 assert.equal(publicDriveFailure({driveStatus:403,driveReason:'insufficientFilePermissions'}).status,409);
});
