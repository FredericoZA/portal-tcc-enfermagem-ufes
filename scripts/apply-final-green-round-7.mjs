#!/usr/bin/env node
import { readFile, writeFile, rm } from 'node:fs/promises';

const path = 'scripts/test-visual.mjs';
let s = await readFile(path, 'utf8');

if (!s.includes("cell.classList.contains('portal-calendar-weekend')")) throw new Error('Seletor temporário de fim de semana não encontrado.');
s = s.split("cell.classList.contains('portal-calendar-weekend')").join("cell.classList.contains('portal-core-calendar-weekend')");

const closeCall = "page.getByRole('button', { name: 'Fechar' }).click();";
const exactCloseCall = "page.getByRole('button', { name: 'Fechar', exact: true }).click();";
if (!s.includes(closeCall)) throw new Error('Botão Fechar ambíguo não encontrado na homologação visual.');
s = s.split(closeCall).join(exactCloseCall);

await writeFile(path, s);
await rm('scripts/apply-final-green-round-7.mjs', { force: true });
console.log('Seletores finais de calendário e fechamento dos diálogos corrigidos.');
