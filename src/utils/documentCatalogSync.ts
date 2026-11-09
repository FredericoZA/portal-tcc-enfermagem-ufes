import {isReferenceDocumentModel} from './referenceDocumentModels';

type Catalog=Record<string,any>;
const entries=(catalog:Catalog)=>Object.entries(catalog||{}).filter(([key,value])=>key!=='__capabilities'&&!isReferenceDocumentModel(key)&&value&&typeof value==='object');

/** Read-only catalog metadata is a new baseline, not a user's Studio edit. */
export function syncCatalogTemplates<T extends {id:string;[key:string]:any}>(previous:T[],catalog:Catalog):T[]{
 const next=[...previous];
 for(const [type,model] of entries(catalog)){
  const index=next.findIndex(item=>String(item.type||'').toUpperCase()===type.toUpperCase());
  const current=index>=0?next[index]:undefined;
  const mapped={id:current?.id||`master-${type.toLowerCase()}`,type,label:String(model.label||current?.label||type),fileName:String(model.fileName||current?.fileName||`${type}.docx`),description:current?.description||'Modelo documental publicado e versionado no Drive institucional.',variables:Array.isArray(model.variables)?model.variables:(current?.variables||[]),fields:current?.fields||[],templateContentText:current?.templateContentText||'',lastUpdated:String(model.uploadedAt||current?.lastUpdated||''),driveFileUrl:String(model.driveFileUrl||current?.driveFileUrl||''),driveFileId:String(model.driveFileId||current?.driveFileId||'')} as unknown as T;
  if(index>=0)next[index]=mapped;else next.push(mapped);
 }
 return next;
}

export function syncCatalogColumns<T extends {id:string;[key:string]:any}>(previous:T[],catalog:Catalog):T[]{
 const next=[...previous];
 const known=new Set(next.flatMap(column=>[column.id,column.name,...(column.aliases||[])].map(value=>String(value||'').toUpperCase())));
 for(const [,model] of entries(catalog))for(const raw of Array.isArray(model.variables)?model.variables:[]){
  const name=String(raw||'').replace(/^<<|>>$/g,'').replace(/^\{\{|\}\}$/g,'').replace(/^\[\[|\]\]$/g,'').replace(/^«|»$/g,'').replace(/^-|-$/g,'').trim().replace(/[^a-zA-Z0-9À-ÿ]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();
  if(!name||known.has(name))continue;
  next.push({id:name,name,label:name.replace(/_/g,' '),dataType:/EMAIL/.test(name)?'email':/DATA|HORA/.test(name)?'date':'text',aliases:[String(raw)]} as unknown as T);known.add(name);
 }
 return next;
}
