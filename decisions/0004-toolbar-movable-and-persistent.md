# 0004: tornar a toolbar móvel pelo pegador e persistir sua posição

- **Status:** aceito; orientação vertical e posição padrão revistas em [0009](0009-toolbar-tab-and-icons.md)
- **Data:** 2026-09-25
- **Escopo:** interação e design system

## Contexto

Uma toolbar fixa pode cobrir conteúdo, ícones ou o fluxo de trabalho do usuário. O requisito do produto pede um pegador lateral que permita mover a toolbar e fixá-la em qualquer lugar do desktop.

## Decisão

A toolbar tem um pegador separado dos botões. O usuário arrasta o pegador para qualquer posição, escolhe orientação horizontal ou vertical e restaura a posição padrão por comando. O app salva posição, monitor e orientação. O pegador tem nome acessível e não ativa uma ferramenta.

## Consequências

- A posição da toolbar faz parte das preferências globais, não do conteúdo de um canvas.
- A restauração precisa tratar mudança de resolução e monitor ausente.
- O canvas mantém prioridade visual quando a toolbar é movida.
- A toolbar precisa continuar utilizável em escala DPI alta e com teclado.

## Alternativas consideradas

- Fixar a toolbar apenas nas bordas. Rejeitada porque reduz a liberdade pedida pelo produto.
- Tornar toda a toolbar arrastável. Rejeitada porque conflita com os botões e aumenta erros de interação.
- Salvar uma posição única sem monitor. Rejeitada porque a posição pode ficar fora da tela ao trocar de monitor.
