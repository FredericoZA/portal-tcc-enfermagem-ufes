import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthProvider } from '../src/context/AuthContext';
import { HomePage } from '../src/pages/HomePage';

const renderHome = (tab: 'calendario' | 'biblioteca') => renderToString(
  React.createElement(
    AuthProvider,
    null,
    React.createElement(HomePage, { initialPublicTab: tab, onNavigate: () => undefined }),
  ),
);

test('HomePage renderiza Calendário sem exceção síncrona', () => {
  const html = renderHome('calendario');
  assert.match(html, /Calendário|agenda de defesas|Lista de Defesas/i);
});

test('HomePage renderiza Repositório sem exceção síncrona', () => {
  const html = renderHome('biblioteca');
  assert.match(html, /Repositório|Acervo Digital/i);
});
