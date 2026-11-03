#!/bin/zsh
set -eu
cd -- "${0:A:h}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null || [[ ! -d node_modules || ! -f .env.local ]]; then
  print 'A preparação local está incompleta. Peça ao Codex para preparar este projeto.'
  read '?Pressione Enter para fechar.'
  exit 1
fi

print 'Portal TCC — desenvolvimento local'
print 'Mantenha esta janela aberta. Para encerrar, pressione Control + C.'
node scripts/open-local.mjs
