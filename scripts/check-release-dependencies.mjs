/** Release-only dependency gate; no credentials/private configuration are printed. */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['audit','--json','--fetch-retries=0','--fetch-timeout=15000'],{encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024});
let audit;try{audit=JSON.parse(result.stdout||'{}');}catch{}
if(!result.error&&!audit?.error&&audit?.metadata){
  console.log('RELEASE_DEPENDENCY_AUDIT',JSON.stringify({source:'npm',vulnerabilities:audit.metadata.vulnerabilities,details:audit.vulnerabilities}));
  if(audit.metadata.vulnerabilities.high||audit.metadata.vulnerabilities.critical)process.exitCode=1;
}else{
  // An unavailable npm advisory endpoint cannot be interpreted as a clean audit.
  // OSV is an independent advisory service; fail closed on any matching advisory.
  const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
  const seen=new Set(),queries=[];
  for(const [location,item] of Object.entries(lock.packages||{})){
    if(!location.includes('node_modules/')||!item.version)continue;
    const name=location.split('node_modules/').at(-1),key=name+'@'+item.version;
    if(seen.has(key))continue;seen.add(key);queries.push({package:{name,ecosystem:'npm'},version:item.version});
  }
  if(!queries.length)throw new Error('Lockfile não forneceu dependências auditáveis.');
  const response=await fetch('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('As auditorias npm e OSV estão indisponíveis.');
  const data=await response.json();if(!Array.isArray(data.results)||data.results.length!==queries.length)throw new Error('Auditoria OSV incompleta.');
  const matches=data.results.flatMap((row,index)=>row.vulns?.length?[{...queries[index],advisories:row.vulns.map(v=>v.id)}]:[]);
  console.log('RELEASE_DEPENDENCY_AUDIT',JSON.stringify({source:'OSV (npm endpoint unavailable)',packages:queries.length,matches}));
  if(matches.length)process.exitCode=1;
}
