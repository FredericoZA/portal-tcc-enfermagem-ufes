import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const write=(file,value)=>fs.writeFileSync(file,value);
const replaceOnce=(text,before,after,label)=>{if(!text.includes(before))throw new Error(`Trecho não encontrado: ${label}`);return text.replace(before,after);};

{
  const file='server.ts';
  let text=read(file);
  const before="function publicSettingsForRequest(admin:boolean):GlobalSettings{const safe=normalizeUnifiedAppearance(redactSensitiveValues(JSON.parse(JSON.stringify(currentSettings))) as GlobalSettings);delete (safe as any).courseCoordinatorEmail;delete (safe as any).courseCoordinatorName;if(!admin){delete safe.masterRecoveryEmails;delete safe.documentModels;delete safe.templateIds;delete safe.emailConfig;delete safe.integrationStudio;delete safe.masterEmail;delete safe.ownerEmail;delete safe.commissionPresidentEmail;delete safe.driveRootFolderId;}return safe;}";
  const after="function publicSettingsForRequest(admin:boolean):GlobalSettings{const safe=normalizeUnifiedAppearance(redactSensitiveValues(JSON.parse(JSON.stringify(currentSettings))) as GlobalSettings);delete (safe as any).courseCoordinatorEmail;delete (safe as any).courseCoordinatorName;if(!safe.contactEmail&&safe.masterEmail)safe.contactEmail=safe.masterEmail;if(!safe.portalMaintainerName&&safe.ownerName)safe.portalMaintainerName=safe.ownerName;if(!admin){delete safe.masterRecoveryEmails;delete safe.documentModels;delete safe.templateIds;delete safe.emailConfig;delete safe.integrationStudio;delete safe.masterEmail;delete safe.ownerEmail;delete safe.commissionPresidentEmail;delete safe.driveRootFolderId;}return safe;}";
  text=replaceOnce(text,before,after,'configuração pública deriva contato do Master');
  write(file,text);
}

{
  const file='src/components/Footer.tsx';
  let text=read(file);
  text=replaceOnce(text,"  const contactEmail=layoutConfig.footerContactEmail||settings?.contactEmail||'';","  const contactEmail=settings?.contactEmail||settings?.masterEmail||layoutConfig.footerContactEmail||'';",'contato do rodapé');
  write(file,text);
}

{
  const file='server/update33CompletionContract.test.ts';
  let text=read(file);
  text += "test('contato público do rodapé deriva do Master sem expor a chave administrativa',async()=>{const [server,footer]=await Promise.all([source('server.ts'),source('src/components/Footer.tsx')]);assert.ok(server.includes('if(!safe.contactEmail&&safe.masterEmail)safe.contactEmail=safe.masterEmail'));assert.ok(server.includes('delete safe.masterEmail'));assert.ok(footer.includes(\"settings?.contactEmail||settings?.masterEmail||layoutConfig.footerContactEmail\"));});\n";
  write(file,text);
}

for(const file of ['scripts/finalize-update33-polish.mjs','.github/workflows/finalize-update33-polish.yml']){try{fs.unlinkSync(file);}catch{}}
console.log('Polimento final da atualização 33 aplicado.');
