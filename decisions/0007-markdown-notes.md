# 0007: renderizar notas com markdown-it sem HTML bruto

- **Status:** aceito
- **Data:** 2026-10-13
- **Escopo:** frontend, dependências e segurança

## Contexto

A [0006](0006-delimited-desktop-area.md) define que notas e post-its são escritos em Markdown, com hierarquia e tabelas. Escrever um parser próprio de Markdown com tabelas custaria mais do que o MVP justifica. O texto vira HTML dentro da WebView do Tauri, onde um script injetado alcançaria a ponte de comandos. Por isso o parser precisa recusar HTML bruto e links perigosos.

## Decisão

O frontend usa `markdown-it` 15 com `html: false`, `linkify: false`, `typographer: false` e a regra de imagem desligada, para que nenhuma nota carregue um arquivo remoto. A sintaxe padrão cobre títulos, listas, ênfase, código, citações e tabelas. O `validateLink` padrão do markdown-it recusa URLs `javascript:`, `vbscript:`, `file:` e `data:`. Um clique em link não navega a WebView. Abrir links fora do app fica para depois do MVP.

**Revisão de 2026-10-14:** por decisão do produto, o markdown-it passou a usar `breaks: true`. Um Enter dentro de um parágrafo quebra a linha, como numa nota rápida, em vez de virar espaço. Isso vale também para as notas já salvas.

## Consequências

- O bundle cresceu 105 KB minificado, 43 KB com gzip, medidos no build da L3.
- HTML escrito pelo usuário aparece como texto.
- O Markdown renderizado é só leitura. A edição usa o texto bruto em um campo de texto.
- Imagens no Markdown ficam fora do MVP, como previsto em product.md.

## Alternativas consideradas

- **marked.** Menor, mas passa HTML bruto e não filtra URLs por padrão. Exigiria um sanitizador.
- **Parser próprio.** Rejeitado porque tabelas e listas aninhadas custam mais do que o MVP justifica.
- **Editor rico.** Rejeitado porque aumenta dependências e foge do texto em Markdown pedido pelo produto.
