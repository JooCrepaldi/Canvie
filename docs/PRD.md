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
| Canvas (padrão) | boot, ou `Ctrl+L` / `Ctrl+Alt+T` / `Esc` de volta | Janela parentada no Progman atrás dos ícones; visível como wallpaper, sem receber clique (física do DefView). Desenho exige `Ctrl+D`. |
| Draw elevado (`raised`, não é modo, é flag dentro do Canvas/Lock) | `Ctrl+D` alterna; no Locked, um toque desbloqueia e já eleva; no Overlay é no-op | Canvas continua filho do Progman mas ordenado acima dos ícones (ainda abaixo de taskbar/janelas) para receber mouse. Pill indica estado. |
| Lock | `Ctrl+L` alterna (no-op dentro do Overlay) | `setIgnoreCursorEvents(true)`, canvas congelado e clicável-através; `raised` é zerado ao entrar. |
| Overlay | `Ctrl+Alt+T` alterna; `Esc` volta | Desanexa do Progman, `alwaysOnTop(true)` + foco; ao sair, volta para `return_to` (Canvas ou Locked) e re-embebe. |

Detalhe de implementação: `ModeState` em `frontend/src-tauri/src/lib.rs:36-56`, transições em `apply_mode` / `toggle_*_inner`, evento `canvie-mode` para o frontend. Ver `docs/ARCHITECTURE.md`.

### Divergência conhecida README vs. real

O README cita `Win+T` para Overlay. `Win+T` pertence ao Explorer (`RegisterHotKey` falha com "already registered"). O MVP-0 usa `Ctrl+Alt+T` até decisão de produto. Não mudar atalho sem atualizar README + este PRD + `lib.rs:340-344`.

## 4. Atalhos (real MVP-0)

| Entrada | Ação real |
| --- | --- |
| `1` / `2` | caneta / borracha (temporário, sem toolbar) |
| `Ctrl+D` | erguer/afundar canvas para desenhar no wallpaper |
| `Ctrl+L` | travar/destravar (Lock) |
| `Ctrl+Alt+T` ou `Esc` (no Overlay) | Overlay on/off |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | desfazer/refazer (pilha em memória) |
| `Space+arrastar` | pan |
| `Scroll` | zoom centrado no cursor |
| Duplo-clique | criar texto simples (Enter confirma, Esc cancela) |

Planejado v1 (não existe no MVP-0): `Q` toolbar, paleta, atalhos editáveis, `Ctrl+V` imagem/clipboard, arrastar arquivo.

## 5. Canvas MVP-0 (congelado)

- Um `<canvas>` fullscreen, DPR-aware, transform de câmera (`screenToWorld`/`worldToScreen`).
- Ferramentas: caneta branca fixa (`PEN_WIDTH=3`), borracha (`ERASER_WIDTH=24`), sem escolha de cor/espessura.
- Texto simples sem markdown, uma fonte do sistema, sem edição após confirmar (só mover via recarga? na prática: cria/apaga via undo, sem select/move/resize).
- Undo/redo só em memória (perde histórico ao reiniciar; o documento persiste, o histórico não).
- Pan/zoom com câmera restaurada no boot.
- Pill de ajuda centralizada acima da taskbar, `pointer-events: none`, visível nos 3 modos.

## 6. Persistência (congelada)

- Modelo: `{ version: 1, strokes: [{id, points, erase}], texts: [{id, at, content}], camera: {x, y, zoom} }` (`frontend/src/persistence.ts:4-9`, `frontend/src/canvasTypes.ts`).
- Onde: `localStorage` do perfil WebView2 (`canvie.canvas.v1`), que vive em `%APPDATA%/com.canvie.app`. Sem comando Rust dedicado — suficiente para o MVP-0.
- Como: save com debounce ~500ms (`createSaver`), load no boot, valida e retorna null se corrompido (boota vazio, nunca crasha), `reseedIds` além do maior id restaurado.
- Done: matar no Gerenciador de Tarefas e reabrir volta idêntico.

## 7. Segundo plano (congelado)

- Tray com Show / Lock / Draw / Overlay / Autostart / Quit; fechar (X) esconde para o tray, só Quit sai.
- Single-instance: 2ª instância sai e foca a 1ª.
- Autostart habilitado no setup, apontando para o build instalado (`%LOCALAPPDATA%\Canvie\canvie.exe`), nunca dev binary.
- Global shortcuts registradas com falha degradada (log warn, app continua).

## 8. Wallpaper embedding (congelado)

- Canvas é filho do Progman ordenado atrás do `SHELLDLL_DefView` (atrás dos ícones, taskbar e janelas normais). Só monitor primário. Se o Explorer reiniciar, reabrir o app.
- Atrás do DefView = sem input (o DefView consome todo hit-test). Por isso existe o `Ctrl+D`. Desenhar "atrás dos ícones" é impossível — é física, não bug.
- Overlay desanexa para janela top-level normal e re-anexa ao sair.

## 9. Critérios de aceite MVP-0

- Instala sem erro, abre em < 5s, idle < 150MB RAM e ~0% CPU.
- Desenha/apaga/pan/zoom/texto funcionam; `Ctrl+L` congela; `Ctrl+Alt+T` traz para frente e `Esc` devolve.
- Kill + reboot: canvas intacto, tray ativo, autostart aponta para o instalado.
- E2E real (não mock): `scripts/e2e/l4-modes.ps1`, `l5-background.ps1`, `l6-accept.ps1`, `wallpaper-layers.ps1`. Ver `docs/OPERATIONS.md`.

## 10. Não-metas do MVP-0 (não fazer, ir para v1)

Toolbar `Q`, 3 brushes, paleta, setas/formas/cards, markdown com fontes, fundo sólido/transparente configurável, imagens/clipboard/arrastar-arquivo, seleção/mover/redimensionar/apagar individual, atalhos editáveis, multi-monitor real, Linux.

## 11. Esboço v1 (intenção, sem detalhar)

Conforme README: navegar com pan/zoom, fundo sólido ou transparente, caneta/pincel/marcador em cores, setas/formas/cards, textos Markdown, imagens via arrastar/colar, selecionar/mover/redimensionar/apagar, undo/redo, 3 modos, atalhos personalizáveis, autosave após reboot. Cada item vira especificação própria antes de implementar — nada aqui autoriza código.

## 12. Métricas de produto

Sucesso = composição em segundos + reboot intacto + alternância de modos sem "sensação de app". Sem analytics (local-first, nada phona home).
