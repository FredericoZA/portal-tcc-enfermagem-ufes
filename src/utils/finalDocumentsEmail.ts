import {processLink} from './processLink';

export const isFinalDocumentsEmail=(eventCode='',templateId='')=>templateId==='email-conclusao'||(!templateId&&eventCode==='PROCESS_COMPLETED');
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** One notification, one destination. Shared by delivery and the Studio preview. */
export function finalDocumentsEmail(input:{process:{id:string;protocolo:string;titulo:string;aluno1:{nome:string;email:string};aluno2?:{nome:string;email:string};orientador:{nome:string;email:string};banca:Array<{nome:string;email:string}>};recipient:string;baseUrl:string;courseName:string;color?:string}){
 const {process:p,recipient}=input;
 const names=[p.aluno1.nome,p.aluno2?.nome].filter(Boolean).join(' e ');
 const href=processLink(input.baseUrl,p.id,'docs');
 const greeting='Prezados participantes do TCC,';
 const intro='As assinaturas do TCC foram concluídas. Na aba Documentos do processo, consulte e baixe os documentos assinados.';
 const access=`Para entrar, use ${recipient} e informe o código enviado a esse endereço.`;
 const note='As opções de publicação do trabalho e do resumo expandido podem ser consultadas na aba Repositório.';
 const subject=`[Portal TCC] Assinaturas concluídas e documentos disponíveis | ${p.protocolo}`;
 const text=[greeting,intro,`Trabalho: ${p.titulo}\nAutoria: ${names}`,`${p.protocolo}: ${href}`,access,note,`Atenciosamente,\nComissão de TCC\n${input.courseName}`].join('\n\n');
 const color=/^#[a-f0-9]{6}$/i.test(input.color||'')?input.color:'#005b3b';
 const para=(s:string)=>`<p style="margin:0 0 20px">${escape(s)}</p>`;
 const html=`<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#f2f5f4;color:#243c34;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fdfefd;border:1px solid #dbe4df;border-radius:12px"><tr><td style="padding:24px 28px 20px;border-bottom:1px solid #dbe4df;font-size:13px;color:#486256"><strong>PORTAL TCC</strong><br><span style="display:inline-block;padding-top:6px">${escape(input.courseName)}</span></td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.65"><h1 style="margin:0 0 24px;font-size:24px;line-height:1.25;color:#153e2e">Assinaturas concluídas e documentos disponíveis</h1>${para(greeting)}${para(intro)}<p style="margin:24px 0;padding:16px;background:#edf2ef;border-radius:8px;font-size:14px"><strong>${escape(p.titulo)}</strong><br><span style="color:#53675d">${escape(names)}</span></p><p style="margin:28px 0;text-align:center"><a href="${escape(href)}" style="display:inline-block;background:${color};color:#fdfefd;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:7px">${escape(p.protocolo)}</a></p><p style="margin:0 0 24px;color:#53675d;font-size:13px">${escape(access)}</p>${para(note)}<p style="margin:28px 0 0">Atenciosamente,<br><strong>Comissão de TCC</strong></p></td></tr></table></td></tr></table></body></html>`;
 return {subject,text,html};
}
