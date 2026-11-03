import React from 'react';
import { formatTccTitle } from '../utils/formatters';
import { renderInstitutionName } from '../utils/institutionName';
import { renderCustomLocationName } from '../utils/customDefenseLocation';

type PreviewKind = 'title' | 'institution' | 'location';

/**
 * A prévia não modifica o campo nem os dados enviados. Mostra a forma como o
 * conteúdo será apresentado nos documentos a partir dos formatadores do portal.
 */
export function RegistrationFieldPreview({
  kind,
  value,
}: {
  kind: PreviewKind;
  value: string | null | undefined;
}) {
  const input = String(value || '').trim();
  if (!input) return null;

  const formatted = kind === 'institution'
    ? renderInstitutionName(input)
    : kind === 'location'
      ? renderCustomLocationName(input)
      : formatTccTitle(input);

  if (!formatted) return null;

  return (
    <p data-portal-document-preview={kind} className="mt-1 text-[10px] leading-4 text-slate-600">
      Nos documentos: <span className="font-medium text-slate-700">{formatted}</span>
    </p>
  );
}

/** Encontra os campos relevantes sem depender do modelo configurável de cadastro. */
export function registrationPreviewKind(
  fieldKey: string,
  label: string,
  fieldType: string,
): PreviewKind | null {
  if (!['text', 'textarea'].includes(fieldType)) return null;

  const key = String(fieldKey || '').toUpperCase();
  const displayLabel = String(label || '').toLocaleLowerCase('pt-BR');

  if (/^nome completo do local\b/u.test(displayLabel) || /^(?:DEFESA_)?(?:OUTRO_)?LOCAL_(?:OUTRO_)?NOME$/.test(key) || key === 'NOME_COMPLETO_LOCAL' || key === 'DEFESA_LOCAL_PERSONALIZADO') {
    return 'location';
  }

  if (/(^|_)INSTITUICAO($|_)/.test(key) || /\binstituiç[aã]o\b/u.test(displayLabel)) {
    return 'institution';
  }

  if (/^TITULO($|_)/.test(key) || /^t[ií]tulo\b/u.test(displayLabel)) {
    return 'title';
  }

  return null;
}
