import {DOCUMENT_ISSUER_LINES,EMAIL_ISSUER_LINES,documentHeaderLines} from './institutionalIdentity';
import {institutionalDocumentLogo} from './institutionalDocumentLogo';
import type {IntegrationStudioSettings} from '../types/integrationStudio';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Inline styles and bgcolor keep instructional highlights visible in mail clients. */
export function emailInstructionBox(content:string):string{
 return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px"><tr><td bgcolor="#fffbeb" style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;color:#451a03">${content}</td></tr></table>`;
}
/** Email-client compatible tables and inline styles; a single, explicit destination. */
export function operationalEmailLayout(input:{text:string;subject:string;href:string;label:string;studio?:Partial<IntegrationStudioSettings>;templateId?:string;actionLayout?:'stacked';actions?:Array<{href:string;label:string;tone?:'danger'}>}){
 const brand=input.studio?.brandKit,design=input.studio?.emailDesigns?.[input.templateId||''];
 const isUfes=!brand?.institutionName||/\bUFES\b|Universidade Federal do Esp[íi]rito Santo/iu.test(brand.institutionName);
 const configuredHeader=design?.headerText||brand?.courseName||'Portal TCC';
 const institutionalHeader=documentHeaderLines({institution:brand?.institutionName,course:brand?.courseName});
 const configuredLines=configuredHeader.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>line.toLocaleUpperCase('pt-BR'));
 // Expand saved standard one/two-line headings; keep explicitly customized headings editable.
 const standardHeader=!design?.headerText?.trim()||configuredLines.every(line=>institutionalHeader.includes(line));
 const headerLines=isUfes&&standardHeader?institutionalHeader:configuredLines;
 const issuerLines=isUfes?EMAIL_ISSUER_LINES:DOCUMENT_ISSUER_LINES;
 const color=/^#[a-f\d]{6}$/i.test(brand?.primaryColor||'')?brand!.primaryColor:'#005830';
 const image=(url:string|undefined,alt:string,logo=false)=>{
  if(!url||!/^(https:\/\/|http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/|data:image\/(png|jpeg|webp);base64,|\/(?!\/))/.test(url))return '';
  // A distinct PNG URL avoids mail proxies flattening legacy transparent WebP logos.
  const source=logo&&/\/api\/public\/runtime-assets\/[a-f0-9]{64}$/.test(url)?url+'?format=png':url;
  return `<img src="${escape(source)}" alt="${alt}" style="display:block;border:0;${logo?`background-color:#ffffff;border-radius:50%;width:64px;height:64px;object-fit:contain;`:''}max-width:100%;max-height:${logo?64:140}px;height:auto;margin:0 auto ${logo?0:18}px">`;
 };
 let clean=input.text.replace(/Comissão de TCC/giu,'Comissão de Trabalho de Conclusão de Curso').replace(/Para entrar, use[^\n]+/g,'').replace(/https?:\/\/[^\s<>]+/g,'').replace(/\([^)]*\?tcc=[^)]*\)/g,'').replace(/^.*(?:E-mail de acesso:|Entre com o e-mail cadastrado|O acesso ao TCC).*$/gm,'').replace(/^\s*(?:Acesso ao TCC[^\n]*|TCC(?:-\d{4}-\d+| - \d{5})\s*:)\s*$/gm,'').replace(/\(\s*\)/g,'').replace(/^\s*(?:Acesse o portal|Acompanhe o status em seu painel|Acesse o seu painel)\s*:\s*$/gim,'').trim();
 if(!isUfes)clean=clean.replace(/Comissão (?:de TCC|de Trabalho de Conclusão de Curso)(?!\nDepartamento de Enfermagem)/g,DOCUMENT_ISSUER_LINES.join('\n'));
 if(isUfes)clean=clean.replace(/^Atenciosamente,?[ \t]*\r?\n([\s\S]*)$/im,(_closing,tail:string)=>{
  // Normalize only the institutional signature, retaining additional custom contacts.
  const issuer=/^(?:Comissão (?:de TCC|(?:de|dos?) Trabalhos? de Conclusão de Curso)(?: do Departamento de Enfermagem)?(?:\s*[•·—–-]\s*UFES)?|Departamento de Enfermagem|Curso (?:de Graduação em|de) Enfermagem e Obstetrícia(?:\s*[•·—–-]\s*CCS\s*\/?\s*UFES)?)$/iu;
  const lines=tail.split(/\r?\n/).map(line=>line.trim());
  if(!lines.some(line=>issuer.test(line)))return `Atenciosamente,\n${tail}`;
  const extra=lines.filter(line=>line&&!issuer.test(line));
  return ['Atenciosamente,',...issuerLines,...extra].join('\n');
 });
 const paragraphs=clean.split(/\n\s*\n/).filter(Boolean);
 const actions=input.actions||[{href:input.href,label:input.label}];
 const actionLink=(action:typeof actions[number])=>`<a href="${escape(action.href)}" style="display:inline-block;background:${action.tone==='danger'?'#b91c1c':color};color:#ffffff;padding:13px 24px;margin:4px;border-radius:24px;text-decoration:none;font-weight:bold;${input.actionLayout==='stacked'?'max-width:100%;box-sizing:border-box;':''}">${escape(action.label)}</a>`;
 const button=input.actionLayout==='stacked'
  ?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0">${actions.map(action=>`<tr><td align="center" style="padding:4px 0;text-align:center">${actionLink(action)}</td></tr>`).join('')}</table>`
  :`<p style="margin:26px 0;text-align:center">${actions.map(actionLink).join(' ')}</p>`;
 let placed=false;
 let guidance:string[]|null=null;
 const chunks:string[]=[];
 const flushGuidance=()=>{if(guidance){chunks.push(emailInstructionBox(guidance.join('')));guidance=null;}};
 for(const p of paragraphs){
  const heading=p.startsWith('ORIENTAÇÕES DO PROCESSO'),closing=/^Atenciosamente/i.test(p);
  if((heading||closing)&&!placed){chunks.push(button);placed=true;}
  if(closing)flushGuidance();
  if(heading){flushGuidance();guidance=[`<h2 style="font-size:15px;margin:0 0 12px">${escape(p)}</h2>`];continue;}
  const html=p.startsWith('• Asten:')||p.startsWith('• Asten (preferencial):')
   ? `<ul style="margin:0 0 12px;padding-left:22px;font-size:13px;line-height:1.6">${p.split('\n').map(item=>`<li style="margin-bottom:8px">${escape(item.replace(/^• /,'')).replace(/^(Asten(?: \(preferencial\))?|Gov\.br):/,'<strong>$1:</strong>')}</li>`).join('')}</ul>`
   : `<p style="margin:0 0 12px;${closing?'text-align:right':''}">${escape(p).replace(/^(Autores(?: e orientador)?|Orientador|Asten|Gov\.br|Participantes|Convidados|Departamento|Presidência):/,'<strong>$1:</strong>').replaceAll('\n','<br>')}</p>`;
  if(guidance)guidance.push(html);
  else chunks.push((/^(?:Observaç(?:ão|ões)|Instruç(?:ão|ões)|Nota|Atenção):/iu.test(p)||/^(?:A confirmação ou a negativa|Use o botão|Baixe o PDF|Acompanhem? o agendamento|O departamento registrará|Confira o local|O orientador registrará)/iu.test(p))?emailInstructionBox(html):html);
 }
 flushGuidance();
 const body=chunks.join('');
 const textDestination=`${input.label}: ${input.href}`;
 const text=clean.includes('ORIENTAÇÕES DO PROCESSO')?clean.replace('ORIENTAÇÕES DO PROCESSO',`${textDestination}\n\nORIENTAÇÕES DO PROCESSO`):/Atenciosamente/i.test(clean)?clean.replace(/Atenciosamente/i,`${textDestination}\n\nAtenciosamente`):clean+'\n\n'+textDestination;
 return {text,html:`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#eef2f0;font-family:Arial,sans-serif;color:#243c34"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#fdfefd;border:1px solid #dbe4df"><tr><td bgcolor="${color}" style="background:${color};background-color:${color};color:#ffffff;padding:22px 28px;font-weight:bold;font-size:18px;text-align:center" align="center">${image(institutionalDocumentLogo(input.studio,input.templateId),'Identidade institucional',true)}<div style="margin-top:12px">${headerLines.map(escape).join('<br>')}</div></td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.6">${image(design?.heroImageUrl||brand?.emailBannerUrl,'Imagem institucional')}<h1 style="font-size:20px;line-height:1.35;margin:0 0 24px">${escape(input.subject)}</h1>${body}${placed?'':button}${/Atenciosamente/i.test(clean)?'':`<p style="margin:24px 0 0;text-align:right">Atenciosamente,<br>${issuerLines.map(escape).join('<br>')}</p>`}</td></tr></table></td></tr></table></body></html>`};
}
