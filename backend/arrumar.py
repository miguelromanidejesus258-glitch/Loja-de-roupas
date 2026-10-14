# main.py que NÃO mexe na formatação
from pathlib import Path

ARQUIVO = Path(__file__).parent.parent / "public" / "loja.html"
texto = ARQUIVO.read_text(encoding='utf-8', errors='ignore')

# Você edita só trocando texto, sem BeautifulSoup
# Exemplo:
texto = texto.replace('69,99R$', '59,99R$', 1)

ARQUIVO.write_text(texto, encoding='utf-8')
print("Salvo sem estragar!")