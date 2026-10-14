from bs4 import BeautifulSoup
from pathlib import Path

# ARQUIVO CERTO - é esse onde tá a section mais-vendidos
ARQUIVO = Path(__file__).resolve().parent.parent / "public" / "loja.html"

print(f"Usando: {ARQUIVO}")

with open(ARQUIVO, 'r', encoding='utf-8', errors='ignore') as f:
    soup = BeautifulSoup(f, 'html.parser')

cards = soup.select("article.card")
print(f"=== ACHEI {len(cards)} CARDS ===\n")

for i, card in enumerate(cards):
    nome = card.get('data-name') or (card.find("h4").text.strip() if card.find("h4") else "sem nome")
    preco = card.get('data-price') or (card.find("p", class_="preco-card").text.strip() if card.find("p", class_="preco-card") else "sem preço")
    print(f"[{i}] {nome} | {preco}")

# --- EXEMPLO: EDITAR O CARD 0 ---
if cards:
    print("\n--- Editando card 0 ---")
    c = cards[0]
    c['data-name'] = "Camisa RMX Store Masculina Preta - OFERTA IMPERDÍVEL"
    c['data-price'] = "47,90R$"
    c['data-link'] = "https://seu-link-de-venda.com"

    # Atualiza o que aparece na tela
    if c.find("h4"):
        c.find("h4").string = "Camisa RMX Store Masculina Preta - OFERTA"
    if c.find("p", class_="preco-card"):
        c.find("p", class_="preco-card").string = "47,90R$"

    with open(ARQUIVO, 'w', encoding='utf-8') as f:
        f.write(str(soup))

    print(f"\n✅ SALVO! Abre o arquivo {ARQUIVO} no navegador pra ver.")