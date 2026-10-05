import React from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckSquare,
  Clock,
  Code2,
  FileCheck,
  FileText,
  GitBranch,
  GraduationCap,
  HelpCircle,
  ListTodo,
  MapPin,
  ShieldCheck,
  Sliders,
  Table,
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
  | 'documents'
  | 'indicators'
  | 'tutorial'
  | 'flow'
  | 'replication';

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
  if (textFormat?.headerShowEmojis === false || textFormat?.headerIconStyle === 'hidden') {
    return null;
  }

  const effectiveEmoji = customEmoji || textFormat?.customHeaderEmoji;
  if (effectiveEmoji) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center leading-none select-none ${
          size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base sm:text-lg'
        } ${className}`}
        aria-hidden="true"
      >
        {effectiveEmoji}
      </span>
    );
  }

  const Icon = {
    calendar: Calendar,
    list: ListTodo,
    repository: BookOpen,
    graduation: GraduationCap,
    coordination: FileCheck,
    settings: Sliders,
    variables: Table,
    agenda: Clock,
    evaluation: CheckSquare,
    location: MapPin,
    documents: FileText,
    indicators: BarChart3,
    tutorial: HelpCircle,
    flow: GitBranch,
    replication: Code2,
  }[type] || ShieldCheck;

  const iconSize = size === 'lg'
    ? 'h-5 w-5'
    : size === 'sm'
      ? 'h-3.5 w-3.5'
      : 'h-4 w-4 sm:h-[18px] sm:w-[18px]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-white ${className}`}
      aria-hidden="true"
    >
      <Icon className={`${iconSize} stroke-[2.15]`} />
    </span>
  );
};
