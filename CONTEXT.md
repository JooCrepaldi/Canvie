# Contexto do Canvie

Este arquivo define os termos do produto. Ele não descreve implementação.

## Canvie

App para Windows que mantém espaços visuais persistentes associados ao desktop.

## Canvas

Espaço retangular independente. Cada canvas tem largura X, altura Y, fundo, posição e conteúdo próprios.

O canvas é finito. "Formato" no produto significa a relação entre largura e altura, não um espaço infinito.

## Coleção

Conjunto de canvases do usuário. A coleção permite separar contextos de trabalho sem misturar o conteúdo.

## Elemento

Item colocado em um canvas. Os tipos definidos para o primeiro lançamento são imagem, post-it, traço de pincel e texto em Markdown.

## Desktop fixo

Estado em que um canvas permanece associado ao desktop e à posição escolhida pelo usuário entre trocas de janela e reinícios do Windows.

Desktop fixo descreve a posição e a persistência. Ele não impede edição.

## Modo bloqueado

Estado em que o canvas continua visível, mas os elementos não aceitam alteração. O bloqueio é separado da posição fixa.

## Toolbar

Barra compacta que reúne as ferramentas do app. O pegador lateral move a toolbar. A posição e a orientação podem ser fixadas em qualquer lugar do desktop.

## Markdown

Formato de texto usado para escrever e renderizar conteúdo no canvas. Títulos, listas, checklists, links, código, negrito e itálico fazem parte do primeiro recorte.

## Fontes

Configuração visual de um bloco de texto. Inclui família, tamanho, peso, alinhamento e cor.

## Limites atuais

- O produto atende apenas Windows.
- O armazenamento é local.
- Cada canvas tem dimensões definidas.
- A coleção pertence a uma instalação local do app.
- A toolbar pode ser movida e fixada, mas não é um elemento de conteúdo do canvas.
