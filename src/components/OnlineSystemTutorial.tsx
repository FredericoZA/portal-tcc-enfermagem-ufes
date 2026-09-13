import React from 'react';
import { PortalTutorialPage } from '../pages/PortalTutorialPage';

interface OnlineSystemTutorialProps {
  onNavigate?: (tab: string) => void;
}

/**
 * Compatibilidade temporária para pontos antigos que ainda importam
 * OnlineSystemTutorial. A fonte única do guia é PortalTutorialPage.
 */
export const OnlineSystemTutorial: React.FC<OnlineSystemTutorialProps> = ({ onNavigate }) => (
  <PortalTutorialPage onNavigate={onNavigate || (() => undefined)} />
);
