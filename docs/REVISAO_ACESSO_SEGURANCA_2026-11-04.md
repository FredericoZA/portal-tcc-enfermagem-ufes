# Revisão local de acesso, privacidade e segurança — 04/11/2026

Base: candidata `codex/manual-portal-20261104`, partindo de `45c1f335`. Correção da reserva: `1fa315e`. Esta rodada não publica nem altera Vercel, Drive, Supabase, Gmail ou Asten reais.

## Segurança da reserva

A auditoria encontrou um erro de autorização na rota de compatibilidade `POST /api/processes/:id/confirm-location`: um aluno podia anexar seu próprio PDF e declarar que a reserva fora autorizada. A existência do PDF não demonstrava a decisão do departamento ou do orientador.

A rota agora aceita apenas Master/Presidência, exige justificativa administrativa limitada a 1.000 caracteres, mantém a verificação do comprovante da revisão atual e registra ator, motivo, revisão e hash na auditoria. Uma resposta já registrada pelo responsável impede a substituição manual; a correção deve iniciar nova reserva. Os links normais de aceite/recusa continuam vinculados ao destinatário e à revisão, sem depender dessa exceção.

O novo teste HTTP usa processo, PDF, armazenamento e servidor temporários sem credenciais de provedores. Na base anterior, o mesmo teste reproduziu HTTP 202 onde deveria haver 403. Na candidata corrigida, confirma a recusa de aluno/orientador/examinadores, ausência de mutação, necessidade de justificativa, preservação da recusa e auditoria da exceção administrativa legítima. Um revisor independente examinou o diff e executou o teste sem encontrar bypass ou regressão concreta no escopo.

## Acesso e informações públicas

O tutorial, a janela de entrada, o manual PDF, os avisos de privacidade/uso e as informações gerais explicam a pré-autorização da secretaria e o vínculo dos demais participantes pelo cadastro concluído do TCC. Pedir um código não cria autorização. Mantém-se a regra previamente solicitada de aceitar qualquer e-mail autorizado, com institucional UFES como prática normal, sem reintroduzir bloqueio por domínio. A comunicação de convite esclarece o acesso pelo mesmo e-mail registrado.

Nome, matrícula e e-mail são dados pessoais. Também são tratados dados acadêmicos, documentos e registros técnicos. A ficha pública exclui e-mails e registros; autoria e outros metadados selecionados são públicos. A publicação de cada PDF exige autorização própria. Não foi declarada ausência de tratamento de dados pessoais.

Foi removido do menu o código antigo de geolocalização e de consulta externa ao Nominatim. A busca do endereço do usuário e seu cache não são mais acionados. A página Como chegar continua oferecendo os links de navegação.

## Operação convencional e referências

Não foi encontrado modelo generativo ou agente autônomo em operação nos módulos examinados. A checagem de dependências diretas/endpoints conhecidos passou. Textos-base e indicadores usam regras programadas; decisões permanecem humanas. Dados históricos do recurso retirado são preservados sem reativação. Não se apaga a proveniência do desenvolvimento nem se presume dispensa de obrigações institucionais por retirar um recurso operacional.

As páginas oficiais do PPC/organização curricular e das normas de TCC foram consultadas; as referências incluem LGPD, ANPD, aviso de privacidade e manual. A transcrição da Portaria Normativa GR/Ufes nº 310/2026 é fornecida para consulta. Não foi localizado novamente o registro individual ou PDF oficial assinado nesta rodada. Não se afirma autenticação da transcrição, homologação institucional, certificação LGPD ou invulnerabilidade.

## Verificação e limites

- Suíte unitária integrada: 1.045 testes aprovados, zero falhas.
- Fluxo seguro local: 40 verificações aprovadas, zero falhas.
- Regressão HTTP da reserva e fluxos relacionados: 4 testes aprovados.
- Revisão defensiva adicional: 25 testes selecionados de OTP, acesso, DTO/PDF público e rotas retiradas aprovados.
- Contratos de conteúdo atualizados: 13 testes aprovados.
- TypeScript, scanner de segredos e acessibilidade estática aprovados; build e imagens do manual regenerados.
- Manual com 18 páginas; acesso e privacidade incluem as regras atuais e capturas fictícias.

A auditoria estática do Codex Security teve cobertura parcial de autenticação, autorização por processo, projeções públicas, reserva e controles documentais. Identificou uma falha de gravidade média corrigida localmente; não revisou integralmente todos os arquivos nem as dependências instaladas. Medição de tokens do scan indisponível. O relatório original permanece preservado, distinguindo o achado inicial da correção posterior.

Testes locais não comprovam as permissões das contas e pastas reais, políticas atuais do Supabase/Vercel, contratos, retenção, restauração, entrega de e-mail ou assinatura efetiva nos provedores. Essas verificações operacionais permanecem separadas da revisão de código.
