import type {InstallationProfile} from '../../src/types';
import {buildProtocol} from '../../src/utils/installationProfile';

/** A deleted process still owns its code while cleanup is pending in any platform. */
export function nextAvailableProcessProtocol(profile:InstallationProfile,year:number,active:string[],pendingCleanup:string[]):string{
 const prefix=profile.protocolPrefix.toUpperCase().replace(/[^A-Z0-9_-]/g,'')||'TCC';
 const matcher=new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}-${year}-(\\d+)$`);
 const max=[...active,...pendingCleanup].reduce((value,protocol)=>{
  const match=protocol.match(matcher);return match?Math.max(value,Number(match[1])||0):value;
 },0);
 return buildProtocol(profile,year,max+1);
}
