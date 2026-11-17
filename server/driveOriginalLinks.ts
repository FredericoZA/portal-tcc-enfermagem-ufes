/** IDs come only from an already authorized Portal record, never from a caller URL.
 * Google authenticates the account in the new tab and enforces the original ACL. */
export function canonicalDriveOriginalLinks(fileId:string,expectedSha256?:string):{view:string;download:string}|null{
  if(!/^[a-zA-Z0-9_-]{10,150}$/.test(fileId)||fileId.startsWith('local_')||expectedSha256!==undefined&&!/^[a-f0-9]{64}$/i.test(expectedSha256))return null;
  return {view:`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`,download:`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`};
}
