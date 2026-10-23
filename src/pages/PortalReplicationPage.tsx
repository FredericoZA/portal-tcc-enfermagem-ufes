import React from 'react';
import {Cloud, Database, Download, ExternalLink, FileSignature, FileText, Github, Server, Sparkles} from 'lucide-react';
import {ColorfulHeaderIcon} from '../components/ColorfulHeaderIcon';
import {PortalSectionDivider} from '../components/PortalSectionDivider';

const REPOSITORY_URL = 'https://github.com/FredericoZA/portal-tcc-enfermagem-ufes';
const tools = [
  {icon:Github, title: 'GitHub', text:'Código-fonte e documentação da instalação. Comece lendo README, implantação e política de segurança.', href:REPOSITORY_URL, action:'Abrir no GitHub'},
  {icon:Sparkles, title:'Guia para a IA', text:'Documento com o passo a passo para preparar uma instalação independente, adaptar o curso e conferir o fluxo completo.', href:'/replicacao/GUIA_PARA_IA.md', action:'Baixar guia para a IA', download:true},
  {icon:FileText, title:'Modelos do Google Drive', text:'Convite, ata, termo e declaração em um único arquivo ZIP. Importe cópias próprias e confira as variáveis antes de usar.', href:'/api/public/replication-models/all/download', action:'Baixar modelos', download:true},
  {icon:Server, title: 'Vercel', text:'Hospeda a interface e a API. Use projeto e domínio próprios, configure os segredos no servidor e valide a implantação.'},
  {icon:Database, title: 'Supabase', text:'Banco, auditoria, filas e armazenamento privado. Crie um projeto próprio e aplique as migrações antes de cadastrar processos.'},
  {icon:Cloud, title: 'Google Workspace', text:'Configure OAuth e conta institucional próprios para Drive, Docs, Gmail e Calendar. Separe arquivos acadêmicos e suporte técnico.'},
  {icon:FileSignature, title:'Asten', text:'Configure conta, pastas e retorno HTTPS. Ata: orientador. Termo: autores e orientador. Declaração: presidência da comissão.'},
  {icon:FileSignature, title:'Gov.br', text:'Alternativa de assinatura: preparar o PDF, assinar, devolver e conferir no VALIDAR/ITI. O envio sozinho não conclui a validação.'},
];
const CARD_CLASS = 'portal-layer-card flex h-full min-h-[112px] flex-col rounded-xl border border-slate-300 p-4 shadow-2xs';

export const PortalReplicationPage: React.FC = () => (
  <div id="portal-replication-page" className="portal-public-shell portal-layer-panel mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 shadow-sm">
    <section className="portal-public-header"><div className="portal-public-title-row gap-2"><ColorfulHeaderIcon type="replication"/><h1 className="text-sm font-black normal-case tracking-tight text-white sm:text-base">Replicar Portal</h1></div></section>
    <PortalSectionDivider/>
    <section className="portal-layer-panel p-3 sm:p-4" aria-labelledby="replication-title">
      <h2 id="replication-title" className="text-base font-bold">Criar uma instalação para outro curso</h2>
      <p className="mt-2 max-w-5xl text-sm leading-6">Código, guia para a IA, modelos e serviços estão reunidos abaixo. Siga o guia para configurar uma instalação com banco, contas, arquivos e credenciais próprios.</p>
      <div className="mt-4 grid auto-rows-fr items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map(({icon:Icon,title,text,...tool})=><article key={title} className={CARD_CLASS}>
          <Icon className="h-5 w-5 text-[var(--portal-brand-action)]" aria-hidden="true"/>
          <h3 className="mt-2 text-sm font-black text-slate-950">{title}</h3>
          <p className="mb-3 mt-2 text-xs leading-5 text-slate-600">{text}</p>
          {'href' in tool&&tool.href&&<div className="mt-auto pt-2"><a className="portal-action inline-flex items-center gap-2" href={tool.href} download={'download' in tool&&tool.download?true:undefined} target={'download' in tool&&tool.download?undefined:'_blank'} rel="noreferrer">{'download' in tool&&tool.download?<Download className="h-3.5 w-3.5"/>:<ExternalLink className="h-3.5 w-3.5"/>}{tool.action}</a></div>}
        </article>)}
      </div>
    </section>
  </div>
);
