import React from 'react';
import { UnifiedPortalEditorModal, UnifiedEditorTab } from './UnifiedPortalEditorModal';

interface SiteLayoutEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'header' | 'sidebar' | 'footer' | 'all' | UnifiedEditorTab;
}

export const SiteLayoutEditorModal: React.FC<SiteLayoutEditorModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'header'
}) => {
  let mappedTab: UnifiedEditorTab = 'site_header';
  let mappedScope: 'site_header' | 'site_sidebar' | 'site_footer' | 'all' = 'site_header';

  if (initialTab === 'sidebar' || initialTab === 'site_sidebar') {
    mappedTab = 'site_sidebar';
    mappedScope = 'site_sidebar';
  } else if (initialTab === 'footer' || initialTab === 'site_footer') {
    mappedTab = 'site_footer';
    mappedScope = 'site_footer';
  } else if (initialTab === 'all') {
    mappedTab = 'site_header';
    mappedScope = 'all';
  } else if (
    initialTab === 'table_header' ||
    initialTab === 'buttons' ||
    initialTab === 'table_body' ||
    initialTab === 'table_columns' ||
    initialTab === 'table_general'
  ) {
    mappedTab = 'global_table_style';
    mappedScope = 'all';
  } else {
    mappedTab = 'site_header';
    mappedScope = 'site_header';
  }

  return (
    <UnifiedPortalEditorModal
      isOpen={isOpen}
      onClose={onClose}
      initialTab={mappedTab}
      scope={mappedScope}
    />
  );
};
