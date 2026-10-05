# 0002: usar Progman elevado e click-through para integrar o desktop

- **Status:** superseded by 0005
- **Data:** 2026-09-25
- **Escopo:** janela e input no Windows

## Contexto

Esta decisão registra a pesquisa da primeira proposta. A decisão atual sobre as duas camadas de janela está em [0005](0005-wall-to-edit-transition.md).

O canvas precisa aparecer no desktop sem virar uma janela comum. Ao mesmo tempo, o usuário precisa conseguir clicar nos ícones e nas janelas do Windows. Uma janela simplesmente colocada atrás da camada de ícones não recebe input porque o Explorer consome o hit-test.

## Decisão

No Canvas e no Locked, a janela fica parentada no `Progman` e elevada acima dos ícones, abaixo da taskbar e das janelas comuns. A ferramenta cursor usa click-through para liberar os cliques. O Overlay usa uma janela top-level em primeiro plano e re-embeda ao sair.

Toda transição que altera estilo, foco, `always_on_top` ou `ignore_cursor_events` reaplica o parent, os estilos e a ordem Z. O módulo `wallpaper.rs` é o único dono dessa lógica.

## Consequências

- O canvas permanece visível ao alternar entre ferramentas e modos.
- O cursor e o tray são rotas necessárias para recuperar a edição quando a janela não recebe input.
- Reinício do Explorer exige re-embed no próximo show ou mudança de modo.
- A implementação depende de comportamento Win32 específico e precisa de E2E em máquina Windows.

## Alternativas consideradas

- Manter uma janela maximizada bottom-most. Rejeitada porque não integra de forma confiável com o desktop.
- Colocar a janela atrás de `SHELLDLL_DefView`. Rejeitada porque a camada de ícones consome os eventos.
- Usar hooks ou alterar internals do Explorer. Rejeitada por risco de manutenção e por quebrar o limite de integração definido pelo projeto.

## Fontes

- [SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent)
- [Window Features](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features)
- [SetLayeredWindowAttributes](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setlayeredwindowattributes)
