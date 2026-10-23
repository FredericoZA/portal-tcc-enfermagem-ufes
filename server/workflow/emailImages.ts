import {createHash} from 'node:crypto';
import type {IntegrationStudioSettings} from '../../src/types/integrationStudio';

const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function withEmailImages(studio:Partial<IntegrationStudioSettings>|undefined,templateId:string|undefined,html:string|undefined,text:string,baseUrl:string):string|undefined{
  const design=templateId?studio?.emailDesigns?.[templateId]:undefined;
  if(!design)return html;
  const imageUrl=(value:unknown)=>{
    if(typeof value!=='string'||!value)return '';
    if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))return `${baseUrl.replace(/\/$/,'')}/api/public/runtime-assets/${createHash('sha256').update(value).digest('hex')}`;
    if(/^\/api\/public\/runtime-assets\/[a-f0-9]{64}$/.test(value))return new URL(value,baseUrl).href;
    try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}
  };
  const hero=imageUrl(design.heroImageUrl),logo=imageUrl(design.logoUrl);
  const images=`${hero?`<img src="${escape(hero)}" alt="Imagem institucional" style="display:block;max-width:100%;width:640px;height:auto">`:''}${logo?`<img src="${escape(logo)}" alt="Logo institucional" style="display:block;max-width:100%;height:64px;width:auto;margin:16px 0">`:''}`;
  if(!images)return html;
  if(html&&/<body\b[^>]*>/i.test(html))return html.replace(/<body\b[^>]*>/i,match=>match+images);
  return images+(html||`<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${escape(text)}</div>`);
}
