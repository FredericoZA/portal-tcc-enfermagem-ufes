import fs from 'node:fs';

const path='server/integrations/googleWorkspace.ts';
let source=fs.readFileSync(path,'utf8');
const replaceOnce=(search,replacement,label)=>{
  if(!source.includes(search))throw new Error(`Trecho não encontrado: ${label}`);
  source=source.replace(search,replacement);
};

replaceOnce(
`  return {
    rootFolderId: root.file.id,
    rootFolderUrl: \`https://drive.google.com/drive/folders/\${root.file.id}\`,
    folders,
    modelFiles,
    createdFolders,
    existingFolders,
    uploadedModels,
    existingModels
  };
}

async function listChildren`,
`  return {
    rootFolderId: root.file.id,
    rootFolderUrl: \`https://drive.google.com/drive/folders/\${root.file.id}\`,
    folders,
    modelFiles,
    createdFolders,
    existingFolders,
    uploadedModels,
    existingModels
  };
}

function normalizeDocumentModelType(value:string):string{
  const normalized=String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);
  if(normalized.length<2)throw new Error('Tipo de modelo documental inválido.');
  return normalized;
}

async function ensureDocumentModelFolders(accessToken:string,manifest:GoogleDriveManifest,rawType:string):Promise<{type:string;activeFolderId:string;historyFolderId:string}>{
  const type=normalizeDocumentModelType(rawType);
  let typeFolderId=manifest.folders[\`documents.\${type}\`];
  if(!typeFolderId){
    const known=(DRIVE_FOLDER_NAMES.modelTypes as Record<string,string>)[type];
    const folderName=known||\`99_\${type}\`;
    typeFolderId=(await ensureFolder(accessToken,folderName,manifest.folders.models)).file.id;
    manifest.folders[\`documents.\${type}\`]=typeFolderId;
  }
  for(const lifecycle of DRIVE_FOLDER_NAMES.modelLifecycles){
    const key=\`documents.\${type}.\${lifecycle}\`;
    if(!manifest.folders[key])manifest.folders[key]=(await ensureFolder(accessToken,lifecycle,typeFolderId)).file.id;
  }
  return{type,activeFolderId:manifest.folders[\`documents.\${type}.00_MODELO_ATIVO\`],historyFolderId:manifest.folders[\`documents.\${type}.01_HISTORICO_MODELOS\`]};
}

async function listChildren`,
'inserção do resolvedor de pastas de modelos'
);

replaceOnce(
"export async function publishMasterDocumentModel(input:{type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';fileName:string;content:Buffer;rootFolderName?:string}){",
"export async function publishMasterDocumentModel(input:{type:string;fileName:string;content:Buffer;rootFolderName?:string}){",
'assinatura genérica de publicação'
);
replaceOnce(
`  const manifest=await bootstrapGoogleDriveStructure(token,{rootFolderName:input.rootFolderName});
  const activeFolderId=manifest.folders[\`documents.\${input.type}.00_MODELO_ATIVO\`];
  const historyFolderId=manifest.folders[\`documents.\${input.type}.01_HISTORICO_MODELOS\`];
  for(const current of await listChildren(token,activeFolderId)){`,
`  const manifest=await bootstrapGoogleDriveStructure(token,{rootFolderName:input.rootFolderName});
  const {type,activeFolderId,historyFolderId}=await ensureDocumentModelFolders(token,manifest,input.type);
  for(const current of await listChildren(token,activeFolderId)){`,
'pastas genéricas na publicação'
);
replaceOnce(
"name:`HISTORICO_${input.type}_${stamp}_${current.name}`.slice(0,180),appProperties:{documentType:input.type,lifecycle:'historical-model'",
"name:`HISTORICO_${type}_${stamp}_${current.name}`.slice(0,180),appProperties:{documentType:type,lifecycle:'historical-model'",
'histórico genérico da publicação'
);
replaceOnce("const fileName=`MODELO_ATIVO_${input.type}.docx`;","const fileName=`MODELO_ATIVO_${type}.docx`;",'nome do modelo publicado');
replaceOnce("appProperties:{documentType:input.type,lifecycle:'active-model',uploadedBy:'master'}","appProperties:{documentType:type,lifecycle:'active-model',uploadedBy:'master'}",'metadado do modelo publicado');

replaceOnce(
"export async function registerMasterDocumentModelFromDrive(input:{type:'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';linkOrId:string;rootFolderName?:string}){",
"export async function registerMasterDocumentModelFromDrive(input:{type:string;linkOrId:string;rootFolderName?:string}){",
'assinatura genérica de importação'
);
const registerManifest=`  const manifest=await bootstrapGoogleDriveStructure(token,{rootFolderName:input.rootFolderName});
  const activeFolderId=manifest.folders[\`documents.\${input.type}.00_MODELO_ATIVO\`];
  const historyFolderId=manifest.folders[\`documents.\${input.type}.01_HISTORICO_MODELOS\`];
  for(const current of await listChildren(token,activeFolderId)){`;
replaceOnce(registerManifest,
`  const manifest=await bootstrapGoogleDriveStructure(token,{rootFolderName:input.rootFolderName});
  const {type,activeFolderId,historyFolderId}=await ensureDocumentModelFolders(token,manifest,input.type);
  for(const current of await listChildren(token,activeFolderId)){`,
'pastas genéricas na importação'
);
replaceOnce(
"name:`HISTORICO_${input.type}_${stamp}_${current.name}`.slice(0,180),appProperties:{documentType:input.type,lifecycle:'historical-model'",
"name:`HISTORICO_${type}_${stamp}_${current.name}`.slice(0,180),appProperties:{documentType:type,lifecycle:'historical-model'",
'histórico genérico da importação'
);
replaceOnce("const activeName=source.mimeType===GOOGLE_DOC_MIME?`MODELO_ATIVO_${input.type}`:`MODELO_ATIVO_${input.type}.docx`;","const activeName=source.mimeType===GOOGLE_DOC_MIME?`MODELO_ATIVO_${type}`:`MODELO_ATIVO_${type}.docx`;",'nome do modelo importado');
replaceOnce("documentType:input.type,lifecycle:'active-model',sourceModelId:sourceId","documentType:type,lifecycle:'active-model',sourceModelId:sourceId",'metadado do modelo importado');

fs.writeFileSync(path,source);
console.log('Google document model extension patch applied');
