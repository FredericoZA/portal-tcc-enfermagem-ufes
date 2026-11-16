# Leitura dos documentos pelo Google Drive

O Portal mantém os documentos originais no Drive institucional. A autorização de publicação do TCC e a do resumo expandido são independentes: somente o arquivo autorizado pode receber acesso público de leitura. A entrega direta não cria uma cópia pública e não concede edição ao visitante.

## Acesso dos participantes

Ao arquivar o cadastro e os comprovantes de reserva, o servidor compartilha a leitura desses PDFs com os autores e o orientador que continuam autorizados no processo. A pasta inteira permanece privada, para não expor respostas de formulários destinadas a outros participantes. A operação usa `role=reader` e `sendNotificationEmail=false`, sem enviar uma notificação do Google. Convites e documentos administrativos recebem a leitura após a conferência de sua vinculação ao processo. Os destinatários vêm do cadastro persistido; a requisição do navegador não pode escolher terceiros.

O usuário precisa estar conectado no Google com a conta cujo e-mail recebeu o compartilhamento. O login no Portal não conecta automaticamente essa conta no Google. Um arquivo privado continua exigindo essa autorização no Drive, mesmo que alguém conheça seu link.

O Master encontra em Configurações → Integrações e Plataforma → Google Drive a ação **Atualizar leitura dos participantes**. Ela percorre os processos existentes em lotes de dois, sem recriar PDFs, reenviar convites ou movimentar o fluxo de assinaturas. Falhas são apresentadas por protocolo e podem ser corrigidas e repetidas. A rotina é idempotente para permissões já presentes e aguarda o limite de requisições sem perder o lote atual.

As permissões novas são registradas em propriedades privadas do arquivo. Em uma sincronização posterior, somente as permissões de leitor que o próprio Portal criou podem ser retiradas quando o participante sai do cadastro. Compartilhamentos manuais anteriores e permissões herdadas exigem revisão no Drive; esta rotina não transfere propriedade nem remove editores administrativos.

## Visualização e download

Os botões solicitam links diretamente do Google Drive depois de verificar sessão, vínculo no processo e identidade do documento. Os comprovantes privados também usam essa entrega quando sua versão arquivada está identificada. Não há transferência do corpo do PDF pela Vercel nesse caminho. Se o Google não confirmar o acesso, permanece o caminho compatível autorizado do Portal; portanto, a simples publicação deste código não comprova que todos os PDFs já usam entrega direta.

Comprovantes públicos resumidos continuam protegendo os dados pessoais: não tornam público o comprovante privado original.

## Verificação e recuperação

Uma pasta existente não comprova todos os documentos históricos. Confira cadastro, respostas de reserva e documentos gerados separadamente. Uma reserva pendente não deve ganhar um comprovante de confirmação fictício. Preserve os arquivos históricos e seus identificadores; não regenere um PDF já arquivado apenas para mudar seu nome.

A propriedade institucional e o consentimento OAuth da aplicação são verificações diferentes. Arquivos históricos podem exigir a reconexão Google com a permissão de gerenciamento já autorizada pelo Master, mesmo depois da transferência de propriedade.
