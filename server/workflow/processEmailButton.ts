import type {ProcessData} from '../../src/types';
import {processLink} from '../../src/utils/processLink';
import {emailProcessSection} from '../../src/utils/processEmailGuidance';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function withProcessEmailButton(input:{process:Pick<ProcessData,'id'>;baseUrl:string;eventCode?:string;templateId?:string;text:string;html?:string;color?:string}):string{
 const section=emailProcessSection(input.eventCode||'',input.templateId||'');
 const href=escape(processLink(input.baseUrl,input.process.id,section));
 const label=section==='acervo'?'Acessar entrega no Repositório':section==='cadastral'?'Acessar dados do processo':section==='avaliacao'?'Acessar avaliação e ata':'Acessar documentos do processo';
 const html=input.html||`<div style="font-family:Arial,sans-serif;line-height:1.6">${escape(input.text).replaceAll('\n','<br>')}</div>`;
 // Preserve an existing styled CTA already pointing at the correct TCC and tab.
 if([...html.matchAll(/<a\b([^>]*)>[\s\S]*?<\/a>/gi)].some(match=>match[1].includes(`href="${href}"`)&&/style=["'][^"']*background/i.test(match[1])))return html;
 const color=/^#[a-f0-9]{6}$/i.test(input.color||'')?input.color:'#005b3b';
 const button=`<p data-portal-process-button="true" style="margin:24px 0"><a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${color};color:#ffffff;font-family:Arial,sans-serif;font-weight:bold;text-decoration:none">${label}</a></p>`;
 return /<\/body>/i.test(html)?html.replace(/<\/body>/i,button+'</body>'):html+button;
}
