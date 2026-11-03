# Continuidade e publicação — 28/10/2026

## Ajustes desta rodada

- Fluxo público: avaliação concluída direciona o orientador a Documentos do processo para conferir e assinar a ata.
- Entrega final: instrução descreve confirmação explícita, bloqueio dos campos após o envio e acesso aos documentos.
- README: distingue o cadastro inicial do formulário de homologação do departamento.
- Fluxo mantido: corrige consulta prévia ao Departamento de Enfermagem e permissão administrativa do Master na devolução Gov.br.
- Guia visual 5.1 e PDF: retângulos compactos nos cartões de Fluxos e nos mapas; rodapé sem logo repetida; botão final isolado e centralizado, verde musgo antes e sálvia depois.
- Roteiro de homologação atualizado, com cenários atuais e limites das evidências anteriores.

## Pendência externa que continua aberta

O Portal ainda não executa expurgo definitivo de envelopes Asten. A referência oficial distingue exclusão para a lixeira e expurgo permanente: https://ajuda.astenassinatura.com.br/article/88-excluir-ou-expurgar-envelopes . Antes de implementar, confirmar serviço, parâmetros, permissões, comportamento por estado e retorno que comprove remoção. Não deduzir um endpoint a partir do nome de uma ação da interface.

A fila deve conservar os identificadores e o erro até haver comprovação da remoção. Cancelamento e lixeira não encerram essa pendência. O envelope de declaração ativa não é alvo de limpeza.

Assinatura e arquivamento reais da declaração permanecem distintos do envio confirmado. Não reenviar convite para simular uma conclusão. Os testes locais usam dados isolados; não apagam processos reais nem substituem o piloto institucional.

## Evidências desta rodada

- `.portal-data/release-20261028-ci.log`: suíte completa e build.
- `.portal-data/release-20261028-security.log`: fluxo seguro.
- `output/pdf/padrao-visual-portal-tcc.pdf`: guia visual 5.1, cinco páginas renderizadas e inspecionadas.
- `.portal-data/release-20261028-vercel.log` e `.portal-data/release-20261028-inspect.log`: publicação e consulta do deployment, quando concluídas.

Documentos armazenados anteriormente no Drive não são substituídos por esta atualização do guia. O PDF local atualizado não comprova atualização desses arquivos.

## Resultado da publicação

Produção Ready: `dpl_FuEm8bSD8w55ZNh373L6ubrvM9K2`, criado em 28/10/2026 às 06:17:49 (Brasília). Alias confirmado: https://portal-tcc-enfermagem-ufes.vercel.app/ . Navegador confirmou o texto corrigido na etapa de avaliação e no quadro compartilhado de assinaturas.

Resultado final: 818 testes unitários, 17 contratos e 40 verificações de fluxo seguro aprovados; TypeScript, acessibilidade estática, finalização, build e smoke HTTP local aprovados. A publicação não encerra as pendências externas descritas acima.
