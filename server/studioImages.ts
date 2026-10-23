import type {IntegrationStudioSettings} from '../src/types/integrationStudio';

// Only image fields may bypass whole-package publication validation.
export function applyStudioImage(studio: IntegrationStudioSettings, input: any, actor: string) {
  if (!input || Object.keys(input).some(key => !['kind','templateId','field','value','expectedRevision','expectedImageValue'].includes(key))) throw new Error('Pedido de imagem inválido.');
  const {kind,templateId,field,value,expectedRevision}=input;
  const collection=kind==='email'?'emailDesigns':'formDesigns';
  const currentImage=(studio[collection]?.[templateId] as any)?.[field]||'';
  const matchingImage=Object.prototype.hasOwnProperty.call(input,'expectedImageValue')&&input.expectedImageValue===currentImage;
  if (!Number.isInteger(expectedRevision)||expectedRevision<0||expectedRevision>Number(studio.revision||0)||(expectedRevision!==Number(studio.revision||0)&&!matchingImage)) throw new Error('STUDIO_REVISION_CONFLICT');
  const templates=kind==='email'?studio.emailTemplates:kind==='form'?studio.formTemplates:[];
  if (typeof templateId!=='string' || !templates?.some(template=>template.id===templateId)) throw new Error('Salve o formulário ou e-mail antes de adicionar a imagem.');
  if (!(kind==='email' && ['logoUrl','heroImageUrl'].includes(field) || kind==='form' && field==='logoUrl')) throw new Error('Campo de imagem inválido.');
  if (typeof value!=='string' || value.length>4*1024*1024) throw new Error('A imagem otimizada deve ter até 3 MB.');
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error('Use uma imagem PNG, JPEG ou WebP.');
  const bytes=Buffer.from(match[2],'base64');
  const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if (!valid || bytes.toString('base64')!==match[2]) throw new Error('Conteúdo da imagem inválido.');
  const now=new Date().toISOString();
  return {...studio,revision:Number(studio.revision||0)+1,savedAt:now,savedBy:actor,[collection]:{...studio[collection],[templateId]:{...studio[collection]?.[templateId],templateId,[field]:value}}} as IntegrationStudioSettings;
}
