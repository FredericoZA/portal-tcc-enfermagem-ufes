# Consolidação estrutural — 1.0.58

Esta rodada corrige a base compartilhada das planilhas e das superfícies administrativas, evitando novos hotfixes por tela.

## Planilhas

- uma única paginação canônica por planilha;
- rodapé branco e controles finos, sem folga vertical;
- sticky de cabeçalho, seleção e Processo aplicado a todas as linhas, inclusive a primeira;
- fundo sticky obtido da superfície real da linha, evitando transparência e texto vazando;
- filtros de Meus TCCs preservam famílias amarelo/laranja/verde/azul;
- botão Todos é neutro, branco e com texto preto;
- faixa verde de 2 px após filtros;
- assinatura usa a mesma semântica cromática do calendário: amarelo pendente e verde concluído.

## Configurações

- Rodapé e Identidade e Integrações e Plataforma são destinos diretos, sem navegação lateral interna;
- Acesso, Registros de Assinatura e Registro de Logs abrem como a própria planilha flutuante;
- Integrações recebe quinto cartão para o e-mail institucional de reserva de local, persistido em `emailConfig.departmentReservationEmail`.

## Validação

A release só deve ser publicada após TypeScript, testes unitários/contratos, build, CodeQL, preview e smoke de produção passarem. A conferência visual autenticada continua necessária antes de encerrar definitivamente o lote.
