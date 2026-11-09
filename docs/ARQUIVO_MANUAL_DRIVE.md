# Guarda do manual no Drive

Em 07/11/2026 foi arquivada uma cópia imutável do manual distribuído em `public/manual/manual-portal-tcc.pdf`, dentro de `01_DOCUMENTOS` da instalação oficial. Não foi criada uma pasta paralela nem alterado o catálogo de modelos.

| Artefato | Cópia privada no Drive | Tamanho | SHA-256 |
|---|---|---:|---|
| Manual PDF | `1LosQ2Oejm4qZnVMu-XpoW1Otr2hO05H_` | 1.566.959 bytes | `27f76f158da63c480bde22790bb689a3ffa4c7b500d03f5b316e9de627380763` |
| Gerador Python | `1T2e1PyLoh8rB69jvDNhUDvkxbiyl-4vh` | 29.926 bytes | `d7fdefd7ef19c5fdcccd44aee3725a7187b4dbc8e7a4c4e8ec046f03cb3fcb72` |

Pasta existente: `1fDT5MppK6yJVUVSKvPIGqQrtcn9_qpEt`. Os dois arquivos foram enviados normalmente pelo conector e baixados novamente; tamanho e hash coincidiram com as fontes locais. As permissões lidas têm apenas usuários owner/writer, sem anyone/domain. Isso certifica essas cópias e essa amostra de permissões, sem estender a conclusão a todos os arquivos da instalação.

A distribuição pública continua no Vercel como recurso estático da versão publicada; a cópia privada no Drive é a guarda documental da versão. O upload não muda o site, não concede acesso público ao Drive e não ativa sincronização automática. Uma nova revisão do manual deve receber uma nova cópia versionada e seu próprio hash, preservando as anteriores. O gerador depende dos recursos de imagem/fontes do repositório: o arquivo Python isolado não constitui um pacote independente completo de reprodução.

O manifesto da conferência está em `output/027_manual_drive_manifest_2026-11-07.json`. Nenhum arquivo anterior foi sobrescrito ou excluído. As versões futuras não podem ser chamadas de arquivadas no Drive apenas porque o build local produziu um PDF: é necessário repetir upload e conferência.
