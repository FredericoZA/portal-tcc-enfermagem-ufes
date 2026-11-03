import React from 'react';
import { FileSignature } from 'lucide-react';

type SignatureStep = {
  document: string;
  signers: string;
  when: string;
  where: string;
  how: string;
};

const signatureSteps: SignatureStep[] = [
  {
    document: 'Ata da defesa',
    signers: 'Professor orientador.',
    when: 'Após registrar o conceito e o parecer, a partir do horário da defesa.',
    where: 'Documentos administrativos → Ata Oficial da Defesa Final → Asten ou Gov.br.',
    how: 'O orientador solicita a assinatura nessa caixa. A ata assinada e arquivada libera a entrega final; autores e orientador recebem as instruções.',
  },
  {
    document: 'Termo de autorização de publicação',
    signers: 'Professor orientador e todos os alunos autores.',
    when: 'Após a entrega final, quando houver autorização para tornar público o trabalho, o resumo expandido ou ambos.',
    where: 'Documentos administrativos → Termo de Autorização e Publicação → Asten ou Gov.br. Confirmar a entrega não solicita assinatura automaticamente.',
    how: 'No Asten, todos assinam no mesmo nível. Pelo Gov.br, somente o orientador devolve um único PDF com todas as assinaturas. Sem publicação autorizada, não há Termo nem aviso de assinatura.',
  },
  {
    document: 'Declaração de participação na banca',
    signers: 'Presidente da Comissão.',
    when: 'Por último: após a entrega final, a ata arquivada e o termo assinado e arquivado, quando aplicável.',
    where: 'Área do Presidente → declaração do TCC → Asten ou Gov.br.',
    how: 'A assinatura usa o e-mail da presidência configurado no Portal. A declaração assinada e arquivada permite concluir o processo; ela não é assinada pelos autores ou pela banca.',
  },
];

const headingClasses = 'border border-emerald-800 px-3 py-3 text-left text-[11px] font-black text-white';
const cellClasses = 'border border-slate-300 px-3 py-3 align-top text-[11px] leading-[1.6] text-slate-700';

export const SignatureFlowSummary: React.FC = () => (
  <section
    className="portal-layer-panel mt-4 rounded-2xl border border-slate-300 p-3 sm:p-4"
    aria-labelledby="signature-flow-title"
  >
    <div className="mb-3 flex items-center justify-center gap-2">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100 text-emerald-800" aria-hidden="true">
        <FileSignature className="h-[18px] w-[18px]" />
      </span>
      <h2 id="signature-flow-title" className="text-sm font-black text-slate-950 sm:text-base">
        Assinaturas no processo
      </h2>
    </div>

    <p className="portal-instruction mb-3 rounded-lg px-3 py-2 text-[11px] leading-[1.6]">
      <strong>Orientações:</strong> prefira o Asten para assinar pelo link recebido por e-mail. A escolha do método acontece na caixa do documento ou na Área do Presidente, conforme indicado abaixo.
    </p>

    <div className="overflow-x-auto rounded-xl border border-slate-300" role="region" aria-label="Tabela de assinaturas do processo" tabIndex={0}>
      <table className="w-full min-w-[1000px] table-fixed border-collapse bg-slate-50">
        <colgroup>
          <col style={{ width: '17%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '26%' }} />
        </colgroup>
        <thead className="bg-[var(--portal-brand-header)]">
          <tr>
            <th scope="col" className={headingClasses}>Documento</th>
            <th scope="col" className={headingClasses}>Quem assina</th>
            <th scope="col" className={headingClasses}>Quando solicita</th>
            <th scope="col" className={headingClasses}>Onde escolhe</th>
            <th scope="col" className={headingClasses}>Como avança</th>
          </tr>
        </thead>
        <tbody>
          {signatureSteps.map((step, index) => (
            <tr key={step.document} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-100'}>
              <th scope="row" className={`${cellClasses} text-left font-bold text-slate-950`}>{step.document}</th>
              <td className={cellClasses}>{step.signers}</td>
              <td className={cellClasses}>{step.when}</td>
              <td className={cellClasses}>{step.where}</td>
              <td className={cellClasses}>{step.how}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="portal-instruction rounded-xl p-3 text-[11px] leading-[1.7]">
        <h3 className="mb-1 font-black text-slate-900">Asten: solicitar e acompanhar</h3>
        <p>
          Clique em Asten no documento disponível para solicitar a assinatura. Cada responsável recebe
          um e-mail do Asten para assinar. Acompanhe a situação na caixa do documento e aguarde o arquivamento
          do PDF assinado. Enquanto o envio ou a assinatura estiver pendente, evite repetir o pedido.
        </p>
      </div>
      <div className="portal-instruction rounded-xl p-3 text-[11px] leading-[1.7]">
        <h3 className="mb-1 font-black text-slate-900">Gov.br: assinar e devolver o PDF</h3>
        <p>
          Abra Gov.br na caixa do documento. Use Gerar e baixar PDF ou Baixar PDF para assinar;
          depois abra o assinador Gov.br e devolva o mesmo arquivo por Devolver PDF assinado.
          O orientador devolve a ata e o termo; a presidência devolve a declaração. O Master confere
          as assinaturas no VALIDAR/ITI e registra Aprovar conferência e arquivar. Na Área do Presidente,
          a presidência também pode conferir a declaração.
          Apenas enviar o PDF não conclui a assinatura nem libera a próxima etapa.
        </p>
      </div>
    </div>
  </section>
);
