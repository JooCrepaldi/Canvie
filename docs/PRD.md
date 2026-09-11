# Canvie — PRD (MVP-0 fechado + esboço v1)

> Fonte-da-verdade de produto buildável. O `README.md` é a visão user-facing (pt-BR, não-técnica); este PRD congela o que o MVP-0 entrega de fato e esboça a v1. Em caso de conflito com o código, o código + este PRD vencem e o README é atualizado em seguida (decisão do founder, nunca efeito colateral silencioso — AGENTS.md §3).

## 1. Tese

Um canvas no desktop é útil e agradável. Prova mínima: criar uma composição visual em segundos, reiniciar o Windows e reencontrar o canvas intacto, alternando entre canvas/lock/overlay sem sentir que abriu um app tradicional.

Fora de escopo moral: virar mais um whiteboard dentro de janela, dashboard corporativo, cloud/contas/sync (MVP-0 é local-first).

## 2. Usuário

Quem vive no desktop e pensa visualmente. Nunca pediu um whiteboard; ganha uma parede.

## 3. Modos (comportamento real entregue)

| Modo | Como entra/sai | Comportamento real |
| --- | --- | --- |
| Canvas (padrão) | boot, ou `Ctrl+L` / `Ctrl+Alt+T` / `Esc` de volta | Janela parentada no Progman, elevada acima dos ícones por padrão (atrás de taskbar e janelas). Com a ferramenta cursor ativa, cliques atravessam para o desktop; com pincel/borracha, desenha. |
| Cursor (ferramenta default) | `V`, botão da toolbar ou tray | Click-through na janela: usa o desktop normalmente (ícones, janelas). Voltar ao pincel: `B` com a janela focada, botão da toolbar ou tray. `B` puro não pode ser global (sequestraria a letra no Windows inteiro). |
| Lock | `Ctrl+L` alterna (no-op dentro do Overlay), botão da toolbar ou tray | `setIgnoreCursorEvents(true)`, canvas congelado e clicável-através. |
| Overlay | `Ctrl+Alt+T` alterna; `Esc` volta; botão da toolbar ou tray | Desanexa do Progman, `alwaysOnTop(true)` + foco, sempre interativo; um backdrop com blur + leve escurecida cobre a tela para focar o canvas; ao sair, volta para `return_to` (Canvas ou Locked) e re-embebe elevado. |

Detalhe de implementação: `ModeState` em `frontend/src-tauri/src/lib.rs:36-56`, transições em `apply_mode` / `toggle_*_inner`, evento `canvie-mode` para o frontend. Ver `docs/ARCHITECTURE.md`.

### Divergência conhecida README vs. real

O README cita `Win+T` para Overlay. `Win+T` pertence ao Explorer (`RegisterHotKey` falha com "already registered"). O MVP-0 usa `Ctrl+Alt+T` até decisão de produto. Não mudar atalho sem atualizar README + este PRD + `lib.rs:340-344`.

## 4. Atalhos (real MVP-0)

| Entrada | Ação real |
| --- | --- |
| `V` / `B` / `E` | cursor / pincel / borracha (toolbar, tray ou teclas com a janela focada) |
| `Ctrl+L` | travar/destravar (Lock) |
| `Ctrl+Alt+T` ou `Esc` (no Overlay) | Overlay on/off |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | desfazer/refazer (pilha em memória) |
| `Space+arrastar` | pan |
| `Scroll` | zoom centrado no cursor |
| Duplo-clique | criar texto simples (Enter confirma, Esc cancela) |

Sem `Ctrl+D`: elevar/afundar deixou de existir como conceito — o canvas nasce elevado e o cursor libera o desktop via click-through.

Planejado (não existe ainda): paleta, atalhos editáveis, `Ctrl+V` imagem/clipboard, arrastar arquivo.

## 5. Canvas (v1 inicial)

- Um `<canvas>` fullscreen, DPR-aware, transform de câmera (`screenToWorld`/`worldToScreen`).
- Ferramentas na toolbar sempre visível (acima da taskbar, tooltip com atalho no hover): cursor (`V`, default, libera o desktop), pincel (`B`), borracha (`E`, `ERASER_WIDTH=24`).
- Texto simples sem markdown, uma fonte do sistema, sem edição após confirmar (só mover via recarga? na prática: cria/apaga via undo, sem select/move/resize).
- Undo/redo só em memória (perde histórico ao reiniciar; o documento persiste, o histórico não).
- Pan/zoom com câmera restaurada no boot.

## 6. Persistência (congelada)

- Modelo: `{ version: 1, strokes: [{id, points, erase}], texts: [{id, at, content}], camera: {x, y, zoom} }` (`frontend/src/persistence.ts:4-9`, `frontend/src/canvasTypes.ts`).
- Onde: `localStorage` do perfil WebView2 (`canvie.canvas.v1`), que vive em `%APPDATA%/com.canvie.app`. Sem comando Rust dedicado — suficiente para o MVP-0.
- Como: save com debounce ~500ms (`createSaver`), load no boot, valida e retorna null se corrompido (boota vazio, nunca crasha), `reseedIds` além do maior id restaurado.
- Done: matar no Gerenciador de Tarefas e reabrir volta idêntico.

## 7. Segundo plano (congelado)

- Tray com Show / Cursor / Brush / Eraser / Lock / Overlay / Autostart / Quit; fechar (X) esconde para o tray, só Quit sai. As entradas de ferramenta emitem `canvie-tool` (o frontend aplica).
- Single-instance: 2ª instância sai e foca a 1ª.
- Autostart habilitado no setup, apontando para o build instalado (`%LOCALAPPDATA%\Canvie\canvie.exe`), nunca dev binary.
- Global shortcuts registradas com falha degradada (log warn, app continua).

## 8. Wallpaper embedding (congelado)

- Canvas é filho do Progman elevado acima do `SHELLDLL_DefView` por padrão (acima dos ícones, abaixo de taskbar e janelas normais). Só monitor primário. Se o Explorer reiniciar, o próximo show/mode-change re-embebe e re-eleva.
- Atrás do DefView = sem input (o DefView consome todo hit-test) — por isso o default é elevado; quem libera o desktop é o cursor (click-through), não mais uma ordem de camada.
- Overlay desanexa para janela top-level normal e re-anexa ao sair.

## 9. Critérios de aceite MVP-0

- Instala sem erro, abre em < 5s, idle < 150MB RAM e ~0% CPU.
- Desenha/apaga/pan/zoom/texto funcionam; `Ctrl+L` congela; `Ctrl+Alt+T` traz para frente e `Esc` devolve.
- Kill + reboot: canvas intacto, tray ativo, autostart aponta para o instalado.
- E2E real (não mock): `scripts/e2e/l4-modes.ps1`, `l5-background.ps1`, `l6-accept.ps1`, `wallpaper-layers.ps1`. Ver `docs/OPERATIONS.md`.

## 10. Não-metas (ir para próximos passos v1)

3 brushes, paleta, setas/formas/cards, markdown com fontes, fundo sólido/transparente configurável, imagens/clipboard/arrastar-arquivo, seleção/mover/redimensionar/apagar individual, atalhos editáveis, multi-monitor real, Linux.

## 11. Esboço v1 (intenção, sem detalhar)

Conforme README: navegar com pan/zoom, fundo sólido ou transparente, caneta/pincel/marcador em cores, setas/formas/cards, textos Markdown, imagens via arrastar/colar, selecionar/mover/redimensionar/apagar, undo/redo, 3 modos, atalhos personalizáveis, autosave após reboot. Cada item vira especificação própria antes de implementar — nada aqui autoriza código.

## 12. Métricas de produto

Sucesso = composição em segundos + reboot intacto + alternância de modos sem "sensação de app". Sem analytics (local-first, nada phona home).
