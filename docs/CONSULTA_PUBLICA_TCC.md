# Consulta pública do TCC — revisão local de 26/10/2026

O botão do calendário ou do repositório abre a ficha pública do trabalho pelo identificador ou pelo protocolo. O login é oferecido acima da ficha; Cancelar ou Escape permite continuar a consulta pública. Entrar mantém o TCC e a aba. Quem tem vínculo autorizado acessa a ficha restrita; um usuário sem vínculo continua limitado aos dados públicos.

## Dados e documentos

- A API pública serializa nomes dos autores, orientador, coorientador e banca; título, protocolo, data, local, situação e metadados acadêmicos públicos.
- E-mails, matrículas, SIAPE, registros, respostas internas, auditoria e referências privadas do Drive não integram a ficha pública.
- As abas públicas são Dados do processo, Avaliação e ata (resultado público), Repositório e Documentos do processo. O parecer interno não é serializado.
- Convite emitido e documentos acadêmicos assinados/arquivados podem ser consultados. O termo só aparece quando aplicável à publicação. Documentos pendentes não são disponibilizados.
- Trabalho completo e resumo expandido mantêm autorizações independentes e a checagem de publicação já existente.
- A rota pública de PDF acadêmico revalida disponibilidade e versão, confere contato/registro na cópia e recusa cópias com dados restritos, anexos internos ou sem texto verificável. Não reescreve bytes assinados. Participantes continuam com acesso autorizado aos originais pela rota privada.
- Rascunhos não são públicos. As rotas de assinatura, alteração, documentos privados e histórico continuam exigindo autenticação e autorização.

## Verificações

Os testes locais cobrem o protocolo diferente do ID interno, ficha atrás do login, cancelamento com consulta pública, nome visível sem contato/registro, login por código com retorno à mesma aba, sessão expirada, JSON por lista de campos, PDF emitido, bloqueio de documento pendente e bloqueio de arquivo sem autorização de publicação. A verificação de PDF mantém os bytes originais e recusa e-mail/registro em cópias públicas.

Esta revisão não foi publicada no Vercel e não utiliza documentos reais de produção para os testes. A alteração não torna o bucket ou a pasta privada do Drive públicos.

## Resultado da verificação desta revisão

- Suíte completa: 777 testes e 17 contratos aprovados; TypeScript, segredos, acessibilidade, finalização, compilação e HTTP aprovados. Registro: `.portal-data/public-tcc-final-verified-ci.log`.
- Fluxo seguro: 40 verificações aprovadas, nenhuma falhou. Registro: `.portal-data/public-tcc-secure.log`.
- Navegador: clique real no número do TCC no repositório, ficha pública atrás do login, Cancelar e Escape mantendo a ficha, nomes sem contato/registro, login local por código, mesma entidade/aba, sessão ativa sem novo código e sessão expirada preservando o destino. Registro: `.portal-data/public-tcc-complete-browser.log` e `.portal-data/email-link-review/email-link-result.json`.
- API/PDF: cinco verificações direcionadas de DTO, PDF público, dados restritos, rascunhos e documentos pendentes aprovadas em `.portal-data/public-tcc-final-api-tests.log`.
- Imagem demonstrativa com dados fictícios: `.portal-data/email-link-review/email-link-public-data.png`.

O teste do link também detectou e corrigiu uma regra antiga que forçava a aba Documentos em TCC concluído, mesmo com outra aba explícita no endereço. A transição autenticada resolve o protocolo para a identidade interna apenas após a autorização; a resposta anônima não informa essa identidade.
