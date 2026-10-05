# 0003: manter uma máquina de estados no backend

- **Status:** superseded by 0005
- **Data:** 2026-09-25
- **Escopo:** modos e ponte Tauri

## Contexto

Esta decisão registra a máquina da proposta anterior com Canvas, Locked e Overlay. A máquina atual usa Wall e Edit e está em [0005](0005-wall-to-edit-transition.md).

Canvas, Locked e Overlay alteram foco, parent, ordem Z, click-through e o caminho de retorno. Se o frontend e o backend mantiverem regras próprias, uma transição pode atualizar a aparência sem atualizar a janela.

## Decisão

`ModeState` no backend Rust é a única autoridade para o modo de janela. O frontend espelha o estado pelo evento `canvie-mode`. Comandos e ações do tray passam pela mesma transição, e o backend emite logs de cada mudança.

## Consequências

- Toda origem de comando produz o mesmo resultado.
- O Overlay pode lembrar se deve retornar a Canvas ou Locked.
- O frontend fica responsável por desenho, ferramenta e indicadores visuais.
- Qualquer novo modo precisa entrar nesta máquina antes de aparecer na UI.

## Alternativas consideradas

- Deixar cada componente decidir se está em Overlay. Rejeitada porque duplica regras de transição.
- Manter o modo apenas no frontend. Rejeitada porque a janela do Windows não pode depender de estado que o backend não conhece.
