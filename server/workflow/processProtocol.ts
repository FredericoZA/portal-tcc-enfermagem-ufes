import type {InstallationProfile} from '../../src/types';
import {buildProtocol} from '../../src/utils/installationProfile';

/** Pending deletions retain their numbers until external cleanup completes. */
export function nextAvailableProcessProtocol(profile:InstallationProfile,year:number,active:string[],pendingCleanup:string[]):string{
 const prefix=profile.protocolPrefix.toUpperCase().replace(/[^A-Z0-9_-]/g,'')||'TCC';
 const matcher=new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}-${year}-(\\d+)$`);
 const occupied = new Set<number>();
 for (const protocol of [...active,...pendingCleanup]) {
  const match=String(protocol||'').match(matcher);
  if(!match)continue;
  const sequence=Number(match[1]);
  if(Number.isSafeInteger(sequence)&&sequence>0)occupied.add(sequence);
 }
 let next=1;
 while(occupied.has(next))next++;
 return buildProtocol(profile,year,next);
}
