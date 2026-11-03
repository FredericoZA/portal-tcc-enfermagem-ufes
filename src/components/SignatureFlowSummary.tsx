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
    when: 'Após confirmar a avaliação e conferir a prévia da ata.',
    where: 'Após registrar a avaliação, o orientador confere e assina em Documentos do processo.',
    how: 'Não há aviso separado do Portal para assinar a ata. Com a ata assinada e arquivada, os autores recebem as orientações para a entrega final no Repositório; o orientador também é informado.',
  },
  {
    document: 'Termo de autorização de publicação',
    signers: 'Professor orientador e todos os alunos autores.',
    when: 'Após a entrega final, quando houver autorização para tornar público o trabalho, o resumo expandido ou ambos.',
    where: 'Na entrega, em Repositório → Assinatura do Termo.',
    how: 'Na Asten, todos assinam no mesmo nível. Pelo Gov.br, somente o orientador devolve um único PDF com todas as assinaturas. Sem publicação autorizada, não há Termo nem aviso de assinatura.',
  },
  {
    document: 'Declaração de participação na banca',
    signers: 'Presidente da Comissão.',
    when: 'Por último: após a entrega final, a ata arquivada e o termo assinado e arquivado, quando aplicável.',
    where: 'Asten é o padrão. A presidência pode usar a alternativa Gov.br na Área do Presidente.',
    how: 'A solicitação usa o e-mail da presidência definido em Rodapé e Identidade. A presidência da comissão assina a declaração; o orientador preside a sessão e assina a ata. O processo só termina após o arquivamento dos documentos obrigatórios.',
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
      <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 text-center text-[11px] leading-[1.7] text-slate-700">
        <h3 className="mb-1 font-black text-slate-900">Asten: solicitação automática por e-mail</h3>
        <p>
          Ao solicitar Asten, o Portal primeiro gera o PDF com o modelo publicado e o envia à plataforma.
          Somente após a confirmação do envio, a Asten encaminha o convite aos signatários cadastrados.
          Cada pessoa abre o link recebido e assina. O Portal acompanha o retorno e arquiva o documento assinado.
          Essas mensagens pertencem ao serviço Asten e não são modelos da aba E-mails do Portal.
        </p>
      </div>
      <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 text-center text-[11px] leading-[1.7] text-slate-700">
        <h3 className="mb-1 font-black text-slate-900">Gov.br: assinar e devolver o PDF</h3>
        <p>
          Clique em Gerar e baixar PDF na opção Gov.br do documento. Assine esse PDF no Gov.br e
          devolva o arquivo com todas as assinaturas exigidas na mesma janela do Portal.
          Não é necessário acessar o Drive. A secretaria confere no VALIDAR/ITI antes do arquivamento.
          Apenas enviar o arquivo não conclui a etapa.
        </p>
      </div>
    </div>
  </section>
);
