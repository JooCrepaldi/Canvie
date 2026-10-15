# 0008: crescer com valores prontos depois da 0.0.1

- **Status:** aceito
- **Data:** 2026-10-13
- **Escopo:** produto, documento e interface

## Contexto

A 0.0.1 entregou uma opção de cada coisa, como pede a [0006](0006-delimited-desktop-area.md): uma fonte em três tamanhos, um pincel em três cores e dois fundos. O criador do produto propôs a rodada seguinte: toolbar nova, menu do botão direito, mais fontes, tamanhos e cores, formas, vários canvases, alinhamento automático dos canvases e dois tipos de canvas. Várias dessas ideias contradizem os limites do primeiro ciclo em [product.md](../product.md).

O produto continua provando uma afirmação: um canvas no desktop é útil e agradável. A próxima rodada precisa deixar a anotação mais rápida sem trocar o modelo de uma área e um documento antes da hora.

## Decisão

- As opções crescem como listas curtas e fixas, chamadas de **valores prontos**. Tamanho de texto, fonte, cor de tinta e tema são escolhidos com um clique. O app não oferece seletor livre de cor, campo de tamanho em pixels nem importação de fontes. O zoom aceita um número porque é uma vista, não conteúdo.
- As fontes são as que o Windows já instala. O app não baixa nem embute fontes.
- A 0.2 mantém uma área, um canvas e um documento no monitor principal. Ela entrega a toolbar da [0009](0009-toolbar-tab-and-icons.md), a seleção e a Mão da [0010](0010-implicit-selection-and-hand.md), o menu do botão direito, três fontes, seis tamanhos, seis cores, o marca-texto e cinco temas. A ordem está em [ROADMAP-0.2.md](../docs/ROADMAP-0.2.md).
- A 0.3 entrega vários canvases, formas básicas com seleção e uma janela de configurações.
- A 1.0 entrega o alinhamento automático dos canvases, o Fixed Canvas e o Infinite Canvas, outros monitores, voz para texto e imagens no Markdown.

## Consequências

- O princípio "uma opção de cada coisa" passa a descrever só a 0.0.1.
- A tag v0.0.1 distribuiu o documento v1. A regra da 0006 de acrescentar campos sem migração deixa de valer: a 0.2 migra o v1 para o v2 sem perder o canvas.
- Vários canvases mudam o princípio **Um canvas**. A 0.3 precisa de uma decisão própria antes do código.
- Win + setas pertence ao Windows, como Win + T. O alinhamento automático dos canvases usará outro atalho.

## Alternativas consideradas

- **Seletor livre de cor e tamanho.** Rejeitado porque acrescenta decisões a cada anotação e torna a escolha mais lenta.
- **Vários canvases já na 0.2.** Rejeitado porque muda o documento e o estado de Edição antes de a toolbar nova provar uma edição mais rápida.
- **Uma opção de cada coisa até a 1.0.** Rejeitado porque uma fonte e três tamanhos não cobrem títulos, listas e código, que o Markdown das notas já permite escrever.
