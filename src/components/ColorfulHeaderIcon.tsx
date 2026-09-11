import React from 'react';
import {
  Calendar,
  BookOpen,
  GraduationCap,
  FileCheck,
  Sliders,
  Table,
  MapPin,
  CheckSquare,
  FileText,
  ShieldCheck,
  Clock,
  ListTodo
} from 'lucide-react';
import { TableTextFormat } from './TableColumnSelectorPanel';

export type HeaderIconType =
  | 'calendar'
  | 'list'
  | 'repository'
  | 'graduation'
  | 'coordination'
  | 'settings'
  | 'variables'
  | 'agenda'
  | 'evaluation'
  | 'location'
  | 'documents';

interface ColorfulHeaderIconProps {
  type: HeaderIconType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  customEmoji?: string;
  textFormat?: TableTextFormat;
}

export const ColorfulHeaderIcon: React.FC<ColorfulHeaderIconProps> = ({
  type,
  size = 'md',
  className = '',
  customEmoji,
  textFormat,
}) => {
  // Check if header icons/emojis are hidden
  if (textFormat?.headerShowEmojis === false || textFormat?.headerIconStyle === 'hidden') {
    return null;
  }

  const effectiveEmoji = customEmoji || textFormat?.customHeaderEmoji;

  const containerSize =
    size === 'sm'
      ? 'w-5 h-5 p-1'
      : size === 'lg'
      ? 'w-8 h-8 p-1.5'
      : 'w-6.5 h-6.5 sm:w-7 sm:h-7 p-1 sm:p-1.5';

  const iconSize =
    size === 'sm'
      ? 'w-3 h-3'
      : size === 'lg'
      ? 'w-4.5 h-4.5'
      : 'w-3.5 h-3.5 sm:w-4 sm:h-4';

  // If user selected emoji-only style and has an emoji or icon
  if (textFormat?.headerIconStyle === 'emoji-only' || (effectiveEmoji && textFormat?.headerIconStyle === 'emoji-only')) {
    return (
      <span className={`inline-flex items-center justify-center text-base sm:text-lg select-none shrink-0 ${className}`}>
        {effectiveEmoji || '📌'}
      </span>
    );
  }

  const baseContainerStyle = `${containerSize} rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0 shadow-2xs transition-all hover:bg-slate-200 ${className}`;

  if (effectiveEmoji) {
    return (
      <div className={baseContainerStyle}>
        <span className="text-xs sm:text-sm select-none leading-none">{effectiveEmoji}</span>
      </div>
    );
  }

  switch (type) {
    case 'calendar':
      return (
        <div className={baseContainerStyle} title="Calendário">
          <Calendar className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'list':
      return (
        <div className={baseContainerStyle} title="Lista de Defesas">
          <ListTodo className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'repository':
      return (
        <div className={baseContainerStyle} title="Acervo & Repositório">
          <BookOpen className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'graduation':
      return (
        <div className={baseContainerStyle} title="Trabalhos de Conclusão">
          <GraduationCap className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'coordination':
      return (
        <div className={baseContainerStyle} title="Gestão & Assinatura">
          <FileCheck className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'settings':
      return (
        <div className={baseContainerStyle} title="Configurações">
          <Sliders className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'variables':
      return (
        <div className={baseContainerStyle} title="Planilha de Variáveis">
          <Table className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'agenda':
      return (
        <div className={baseContainerStyle} title="Agenda">
          <Clock className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'evaluation':
      return (
        <div className={baseContainerStyle} title="Avaliações">
          <CheckSquare className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'location':
      return (
        <div className={baseContainerStyle} title="Como Chegar">
          <MapPin className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    case 'documents':
      return (
        <div className={baseContainerStyle} title="Documentos">
          <FileText className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );

    default:
      return (
        <div className={baseContainerStyle}>
          <ShieldCheck className={`${iconSize} stroke-[2.2] text-slate-700`} />
        </div>
      );
  }
};
