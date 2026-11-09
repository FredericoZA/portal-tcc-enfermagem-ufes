import React from 'react';
import { FileSignature } from 'lucide-react';

const signatureSteps = [
  {document: 'Comprovante de reserva', signers: 'Não requer assinatura.', procedure: 'Disponível após o aceite ou a recusa do responsável pelo local.'},
  {document: 'Carta-convite da banca', signers: 'Não requer assinatura.', procedure: 'Disponível após a confirmação da reserva e o envio do convite.'},
  {document: 'Ata da defesa', signers: 'Orientador, dois examinadores, cada autor e coorientador que participou da sessão.', procedure: 'Após o registro e a conferência da ata, o ASTEN encaminha os links individuais aos signatários. A entrega final é liberada após todas as assinaturas exigidas e o arquivamento.'},
  {document: 'Termo de autorização de publicação', signers: 'Orientador e todos os autores.', procedure: 'Após a entrega final, fica disponível somente se algum PDF tiver publicação autorizada. No Asten, todos assinam no mesmo nível; pelo Gov.br, o orientador devolve um único PDF com todas as assinaturas. O termo deve ser arquivado antes da declaração.'},
  {document: 'Declaração de participação na banca', signers: 'Presidente da Comissão.', procedure: 'Após a entrega final e o arquivamento da ata e do termo, quando aplicável, o ASTEN encaminha a declaração à presidência. A declaração assinada e arquivada permite concluir o processo.'},
];

const headingClasses = 'border border-[var(--portal-border-strong)] px-2 py-1.5 text-center text-[11px] font-bold text-[var(--portal-text-dark)]';
const cellClasses = 'border border-[var(--portal-border)] px-2 py-1.5 text-center align-middle text-[11px] leading-[18px] text-[var(--portal-text-dark)]';

export const SignatureFlowSummary: React.FC = () => (
  <section
    className="portal-layer-card mt-4 rounded-xl border border-[var(--portal-border)] p-3 sm:p-4"
    aria-labelledby="signature-flow-title"
  >
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--portal-brand-action)] text-[var(--portal-text-light)]" aria-hidden="true">
        <FileSignature className="h-[18px] w-[18px]" />
      </span>
      <h2 id="signature-flow-title" className="text-sm font-black text-slate-950 sm:text-base">
        Assinaturas no processo
      </h2>
    </div>

    <p className="mb-3 text-xs leading-5 text-slate-700">Em <strong>Documentos administrativos</strong>, consulte a disponibilidade de cada documento e use <strong>Ver</strong> ou <strong>Baixar PDF</strong>. O ASTEN encaminha automaticamente os pedidos quando os documentos ficam disponíveis. Cada responsável assina pelo link individual recebido por e-mail.</p>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" data-signature-layout>
      <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-300" role="region" aria-label="Tabela de assinaturas do processo" tabIndex={0}>
        <table className="w-full min-w-[440px] table-fixed border-collapse bg-[var(--portal-border)]">
          <colgroup><col style={{width: '23%'}}/><col style={{width: '22%'}}/><col style={{width: '55%'}}/></colgroup>
          <thead className="bg-[var(--portal-brand-sage)]"><tr>
            <th scope="col" className={headingClasses}>Documento</th>
            <th scope="col" className={headingClasses}>Quem assina</th>
            <th scope="col" className={headingClasses}>Procedimento</th>
          </tr></thead>
          <tbody>{signatureSteps.map(step => <tr key={step.document}>
            <th scope="row" className={`${cellClasses} font-bold`}>{step.document}</th>
            <td className={cellClasses}>{step.signers}</td>
            <td className={cellClasses}>{step.procedure}</td>
          </tr>)}</tbody>
          <tfoot>
            <tr><th scope="row" className={`${cellClasses} font-bold`}>Asten · preferencial</th><td colSpan={2} className={cellClasses}>O ASTEN envia o pedido quando o documento fica disponível para assinatura. Acompanhe o estado no Portal e assine pelo link pessoal recebido por e-mail.</td></tr>
            <tr><th scope="row" className={`${cellClasses} font-bold`}>Gov.br</th><td colSpan={2} className={cellClasses}>Baixe, assine e devolva o mesmo PDF: o orientador devolve a ata e o termo com todas as assinaturas aplicáveis; a presidência, a declaração. O Master confere no VALIDAR/ITI e registra o arquivamento; a presidência também pode conferir a declaração.</td></tr>
          </tfoot>
        </table>
      </div>
      <figure className="m-0 min-w-0 w-full justify-self-center xl:justify-self-end">
        <a href="/manual/documentos-concluidos.jpg?v=2026-11-04" target="_blank" rel="noreferrer" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-focus)]" aria-label="Ampliar exemplo dos cinco documentos disponíveis">
          <img src="/manual/documentos-concluidos.jpg?v=2026-11-04" alt="Exemplo de processo concluído, com os cinco documentos administrativos disponíveis e os botões Ver e Baixar PDF alinhados." loading="lazy" className="block h-auto w-full rounded-lg" />
        </a>
        <figcaption className="mt-1.5 text-[11px] leading-4 text-slate-600">Exemplo preenchido com dados fictícios. Clique na imagem para ampliar.</figcaption>
      </figure>
    </div>

  </section>
);
