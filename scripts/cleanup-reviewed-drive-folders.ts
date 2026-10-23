import assert from 'node:assert/strict';
import {getGoogleWorkspaceAccessToken} from '../server/integrations/googleWorkspace';

// Exact empty legacy folders inventoried on 22/10/2026. Never recurse.
const parent='1_4gjRh3n4oRhyGGlDkzAWtTz9M2Zj8yO';
const ids=['122DplJWkX2rop86hPFQl0grbSM2YieZw','1XMKXZAMS-jkOzEMlIYi3Ojzavo0dkVyK','1zxGctehAQg5mR_nKdlef5Myhhnem2uct','1bcZHIGs-t8WQ57YQgdVLPNJkI_JKfPaa','1mhkBOhzim41dK6dpi4WNRrtOt40Mvv8_','1_OVuNzTWR0N-QkJBumg-DM3Cw-HfzrFp','14aaPkDxGS28RmXNHew4xKWHnCMEcKdA8'];
const token=await getGoogleWorkspaceAccessToken();
const report=[];
for(const id of ids){
  const url=`https://www.googleapis.com/drive/v3/files/${id}`;
  const metadata=await fetch(url+'?fields=id,mimeType,parents,capabilities(canDelete)&supportsAllDrives=true',{headers:{Authorization:`Bearer ${token}`}});
  if(metadata.status===404){report.push({id,status:'absent'});continue;}
  assert.ok(metadata.ok,'Não foi possível conferir a pasta inventariada.');
  const file=await metadata.json();
  assert.equal(file.mimeType,'application/vnd.google-apps.folder');assert.deepEqual(file.parents,[parent]);
  const children=await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${id}' in parents and trashed = false`)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,{headers:{Authorization:`Bearer ${token}`}});
  assert.ok(children.ok);assert.equal((await children.json()).files.length,0,'Pasta deixou de estar vazia; preservar.');
  if(!file.capabilities?.canDelete){report.push({id,status:'owner_permission_required'});continue;}
  const removed=await fetch(url+'?supportsAllDrives=true',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
  assert.ok(removed.ok,'Não foi possível remover a pasta vazia.');report.push({id,status:'deleted_empty'});
}
console.log('REVIEWED_DRIVE_EMPTY_FOLDERS',JSON.stringify(report));
