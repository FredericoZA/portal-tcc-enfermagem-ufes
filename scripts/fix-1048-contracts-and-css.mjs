import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,v)=>fs.writeFileSync(p,v);
const replace=(src,search,repl,label)=>{const next=src.replace(search,repl);if(next===src)throw new Error(`1048 fixer não encontrou: ${label}`);return next;};

// Remove as últimas regras legadas que ainda pintavam o chip inteiro e dependiam da posição.
{
  const file='src/portal-version-1046.css';
  let src=read(file);
  const start=src.indexOf('/* --------------------------------------------------------------------------\n * Filtros:');
  const end=src.indexOf('/* A coluna de seleção faz parte do mesmo cabeçalho verde da planilha. */',start);
  if(start<0||end<0) throw new Error('Bloco legado de filtros 1046 não encontrado');
  src=src.slice(0,start)+`/* --------------------------------------------------------------------------\n * Filtros: a semântica cromática vive no componente. O botão permanece branco\n * e somente a bolinha comunica estado/papel. Nenhuma regra por nth-child.\n * ----------------------------------------------------------------------- */\n.portal-table-filter-chip,\n.portal-standard-filter-chip {\n  opacity: 1 !important;\n  transform: none !important;\n}\n\n`+src.slice(end);
  write(file,src);
}

// Contrato da homologação atualizado para a arquitetura canônica atual.
write('server/homologacaoVisual20260927Contract.test.ts',`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nconst source=(path:string)=>readFile(path,'utf8');\n\ntest('Lista de Defesas usa estado semântico único e filtro neutro com bolinha',async()=>{\n const [css,formatter,home,tokens]=await Promise.all([source('src/portal-version-1046.css'),source('src/utils/tableFormatters.ts'),source('src/pages/HomePage.tsx'),source('src/utils/portalSemanticTokens.ts')]);\n assert.match(formatter,/resolvePortalFilterTone\\(key\\)/);\n assert.match(formatter,/backgroundColor: '#ffffff'/);\n assert.match(home,/getFilterChipProps\\(statusKey, isSelected, defensesTextFormat/);\n assert.match(home,/portal-filter-dot[\\s\\S]*chip\\.dotColor/);\n assert.match(tokens,/defended:[\\s\\S]*#c2d0c2/i);\n assert.match(tokens,/upcoming:[\\s\\S]*#d4c69a/i);\n assert.doesNotMatch(css,/nth-child\\(2\\)[\\s\\S]*signature|nth-child\\(3\\)[\\s\\S]*defense/i);\n});\n\ntest('Meus TCCs deixa identidade do vínculo somente na bolinha',async()=>{\n const page=await source('src/pages/MeusProcessosPage.tsx');\n assert.match(page,/backgroundColor: '#ffffff'/);\n assert.match(page,/portal-filter-dot/);\n assert.match(page,/backgroundColor: cfg\\.bgColor/);\n assert.doesNotMatch(page,/backgroundColor: cfg\\.bgColor, color: cfg\\.textHex/);\n});\n\ntest('Presidência colore Processo e mantém Envio neutro',async()=>{\n const page=await source('src/pages/CoordenadorPage.tsx');\n assert.match(page,/getProcessToneCssVars/);\n assert.match(page,/Assinatura concluída/);\n assert.doesNotMatch(page,/🟢 Enviada/);\n assert.doesNotMatch(page,/> Publicada</);\n});\n\ntest('Indicadores remove somente o divisor interno redundante',async()=>{\n const css=await source('src/portal-version-1046.css');\n assert.match(css,/#indicadores-publicos-page > \\.portal-section-divider\\s*\\{\\s*display:\\s*none\\s*!important/);\n});\n\ntest('workspaces administrativos continuam embedded',async()=>{\n const [modal,audit,signatures,access]=await Promise.all([source('src/components/SettingsWorkspaceModal.tsx'),source('src/pages/AuditLogsPage.tsx'),source('src/pages/AstenLogsPage.tsx'),source('src/components/AuthorizedStudentsPanel.tsx')]);\n assert.match(modal,/React\\.cloneElement[\\s\\S]*embedded:\\s*true/);\n assert.match(audit,/embedded\\?: boolean/);\n assert.match(signatures,/embedded\\?: boolean/);\n assert.match(access,/embedded\\?: boolean/);\n});\n\ntest('cards de Configurações preservam verde institucional',async()=>{\n const css=await source('src/portal-version-1046.css');\n assert.match(css,/#portal-settings-hub \\.portal-settings-title-bar[\\s\\S]*background:\\s*var\\(--portal-v46-green-dark\\)\\s*!important/);\n});\n`);

// Contrato final não pode exigir a regra removida de um TCC por aluno.
{
  const file='scripts/test-finalization-contract.mjs';
  let src=read(file);
  src=replace(src,`assert.match(server, /STUDENT_TCC_ALREADY_EXISTS/);`,`assert.doesNotMatch(server, /STUDENT_TCC_ALREADY_EXISTS/, 'A release não pode reintroduzir o bloqueio de um único TCC por aluno.');`,'contrato de um TCC');
  write(file,src);
}

// A branch de trabalho não gera preview: só haverá deploy quando a release for mesclada conscientemente.
{
  const file='vercel.json';
  const cfg=JSON.parse(read(file));
  cfg.git=cfg.git||{};cfg.git.deploymentEnabled=cfg.git.deploymentEnabled||{};
  cfg.git.deploymentEnabled['refactor/1.0.48-finalizacao-integral']=false;
  write(file,JSON.stringify(cfg,null,2)+'\n');
}

console.log('CSS e contratos da 1.0.48 alinhados.');
