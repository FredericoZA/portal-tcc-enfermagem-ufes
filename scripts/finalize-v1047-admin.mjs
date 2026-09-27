import fs from 'node:fs';
const astenPath='src/pages/AstenLogsPage.tsx';
let asten=fs.readFileSync(astenPath,'utf8');
const oldRetry="    const canRetry = !demo && RETRYABLE_STATUSES.has(job.status);";
const newRetry="    const canRetry = !demo && RETRYABLE_STATUSES.has(job.status) && (job as SignatureJob & { providerCreationState?: string }).providerCreationState !== 'UNCERTAIN';";
if(!asten.includes(newRetry)){if(!asten.includes(oldRetry))throw new Error('canRetry');asten=asten.replace(oldRetry,newRetry);fs.writeFileSync(astenPath,asten);}
const cssPath='src/portal-semantic-ui.css';let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('.portal-studio-variable-maintenance > div')) css+=`\n/* Variáveis: manutenção compacta e orientada à ação. */\n.portal-studio-variable-maintenance > div{padding:.625rem!important;box-shadow:none!important}.portal-studio-variable-maintenance>div>p{display:none!important}.portal-studio-variable-maintenance .mt-3{margin-top:.5rem!important}.portal-studio-variable-maintenance :is(input,select,button){min-height:2rem}\n`;
fs.writeFileSync(cssPath,css);
for(const path of ['.github/workflows/apply-v1048-admin-ux.yml','scripts/apply-v1048-admin-ux.mjs']) if(fs.existsSync(path))fs.rmSync(path);
