import React from 'react';

/**
 * Orientações breves do processo, exibidas na área de detalhes do TCC.
 * O texto orienta o registro no Portal TCC sem confundi-lo com o lançamento
 * acadêmico da avaliação e da nota no Portal do Professor.
 */
export const ProcessGuidanceNotice: React.FC = () => (
  <section
    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-950"
    aria-labelledby="process-guidance-title"
  >
    <h3 id="process-guidance-title" className="mb-2 text-[11px] font-bold uppercase">
      Orientações do processo
    </h3>
    <p>
      <strong>Autores:</strong> confirmam a data, o horário e o local em Dados do processo.
    </p>
    <p className="mt-2">
      <strong>Orientador:</strong> no dia da defesa, registre o conceito e o parecer na aba “Conceito e Ata” e siga o passo a passo. A avaliação e o lançamento da nota devem ser feitos no Portal do Professor:{' '}
      <a
        href="https://professor.ufes.br/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
      >
        professor.ufes.br
      </a>.
    </p>
  </section>
);
