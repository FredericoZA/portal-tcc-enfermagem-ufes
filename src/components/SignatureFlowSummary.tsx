import { signatureWorkflowBindings } from '../utils/signatureWorkflowBindings';
import React from 'react';

const signatureSteps = [
  {
    document: 'Ata da defesa', binding: signatureWorkflowBindings.ATA,
    signers: 'Professor orientador',
    when: 'Após confirmar a avaliação e conferir a prévia da ata.',
    choice: 'O orientador escolhe em Avaliação e ata → Assinatura da ata.',
    next: 'Com a ata assinada e arquivada, os autores recebem as orientações para a entrega final no Repositório; o orientador também é informado.',
  },
  {
    document: 'Termo de autorização de publicação', binding: signatureWorkflowBindings.TERMO,
    signers: 'Professor orientador e todos os alunos autores',
    when: 'Após a entrega final, quando houver autorização para tornar público o trabalho, o resumo expandido ou ambos.',
    choice: 'Na entrega, em Repositório → Assinatura do Termo.',
    next: 'Todos os signatários precisam concluir. Sem autorização de publicação de nenhum arquivo, o termo fica como Não autorizado e não exige assinatura.',
  },
  {
    document: 'Declaração de participação na banca', binding: signatureWorkflowBindings.DECLARACAO,
    signers: 'Presidente da Comissão',
    when: 'Por último: após a entrega final, a ata arquivada e o termo assinado e arquivado, quando aplicável.',
    choice: 'Asten é o padrão. Para escolher Gov.br antes de iniciar a assinatura, a presidência usa a Área do Presidente.',
    next: 'A solicitação usa o e-mail da presidência definido em Rodapé e Identidade. O processo só termina após o arquivamento dos documentos obrigatórios.',
  },
];

/** Shared explanation of the existing signature workflow, without email templates. */
export function SignatureFlowSummary() {
  return (
    <section aria-label="Assinaturas no processo" className="rounded-lg border border-slate-300 bg-[var(--portal-surface-card)] p-3 text-center text-xs text-slate-700 sm:p-4">
      <h2 className="font-bold text-slate-900">Assinaturas no processo</h2>
      <p className="mt-2 leading-5"><strong>Asten é o método preferencial.</strong> O usuário pode escolher Gov.br nos pontos indicados abaixo, antes de iniciar a assinatura.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-center text-[11px] leading-5">
          <caption className="sr-only">Ordem, responsáveis e escolha do método de assinatura de cada documento</caption>
          <thead className="bg-[var(--portal-surface-card)] text-slate-900">
            <tr>{['Documento e quem assina', 'Quando é solicitado', 'Onde escolher e como avançar'].map(label => <th key={label} scope="col" className="border border-slate-300 p-2 font-bold">{label}</th>)}</tr>
          </thead>
          <tbody>
            {signatureSteps.map(step => (
              <tr key={step.document}>
                <th scope="row" className="w-1/4 border border-slate-300 p-2 align-top font-normal"><strong className="block text-slate-900">{step.document}</strong><span className="mt-1 block">Quem assina: {step.signers}.</span><span className="mt-1 block text-slate-500">Vínculo: {step.binding.source}.</span></th>
                <td className="w-1/3 border border-slate-300 p-2 align-top">{step.when}</td>
                <td className="border border-slate-300 p-2 align-top"><p>{step.choice}</p><p className="mt-1">{step.next}</p></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="rounded-md bg-[var(--portal-surface-inner)] p-3 leading-5"><strong className="block text-slate-900">Asten: solicitação automática por e-mail</strong>Ao iniciar cada assinatura pelo Asten, o provedor encaminha o convite aos signatários cadastrados acima. Cada pessoa abre o link recebido e assina. O Portal acompanha o retorno e arquiva o documento assinado. Essas mensagens pertencem ao serviço Asten e não são modelos da aba E-mails do Portal.</p>
        <p className="rounded-md bg-[var(--portal-surface-inner)] p-3 leading-5"><strong className="block text-slate-900">Gov.br: assinar e devolver o PDF</strong>Prepare e baixe o documento na opção correspondente do processo, assine no Gov.br e devolva o PDF com todas as assinaturas exigidas. A secretaria confere no VALIDAR/ITI antes do arquivamento. Apenas enviar o arquivo não conclui a etapa.</p>
      </div>
      <p className="mt-3 leading-5">A escolha do método não altera quem precisa assinar. Uma solicitação pendente ou com falha ainda não confirma o envio do e-mail nem a assinatura. Acompanhe a situação em Documentos do processo e, para a presidência, na Área do Presidente.</p>
    </section>
  );
}
