from pathlib import Path

path = Path('scripts/apply-v1039.py')
text = path.read_text()
start = text.index("helpers = r'''")
end = text.index("\n'''", start)
block = text[start:end]
# O bloco é raw Python: regex TypeScript precisa de uma única barra invertida.
block = block.replace(chr(92) * 2, chr(92))
path.write_text(text[:start] + block + text[end:])
