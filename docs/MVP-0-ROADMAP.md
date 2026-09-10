# 🧱 Canvie MVP-0 — Roadmap de implementação

> Escopo congelado do MVP-0: janela fullscreen transparente + caneta/borracha + pan/zoom + texto simples + save local + tray/autostart + `Ctrl+L` / `Win+T`. Nada de toolbar completa, markdown, cores de fundo, imagens ou atalhos editáveis.

Stack alvo: **Tauri 2 + Vite + React + TypeScript + Canvas 2D (puro ou Konva.js)**

Cada camada só começa quando a anterior passa no critério de done.

---

## L0 — Fundação (scaffold)

**Objetivo:** repo compila e abre uma janela vazia.

- [ ] Instalar pré-requisitos Windows: WebView2, Rust (stable MSVC), Node 20 LTS, `cargo`, Tauri CLI
- [ ] `npm create vite@latest frontend -- --template react-ts` + `npm create tauri-app` ou `cargo tauri init`
- [ ] Configurar estrutura:
  - `src/` (Tauri/Rust — janela, tray, atalhos)
  - `frontend/` (React — canvas)
  - `docs/` (este roadmap)
- [ ] `npm run tauri dev` abre janela de teste

**Done:** `tauri dev` abre janela em < 5s sem erro.

---

## L1 — Janela desktop (fingir ser wallpaper)

**Objetivo:** janela sem borda, fullscreen, transparente, atrás de tudo.

Configuração da janela (`tauri.conf.json` / código Rust):

- `fullscreen: true`, `transparent: true`, `decorations: false`
- `skipTaskbar: true`, `alwaysOnTop: false` (no Canvas Mode)
- Fundo do HTML: `transparent`, sem `background`

Validações Windows:

- [ ] Aparece sobre o wallpaper, abaixo dos ícones? (MVP finge — janela normal maximizada já vale)
- [ ] Alt+Tab não polui (skipTaskbar funciona)
- [ ] Redimensionar / multi-monitor não quebra

**Done:** desktop visível através da janela, dá para clicar e desenhar nela.

> Nota: injeção real no `Progman/WorkerW` (wallpaper de verdade, abaixo dos ícones) fica para pós-MVP-0. Aqui usamos janela bottom-most.

---

## L2 — Canvas mínimo

**Objetivo:** desenhar, apagar, navegar.

Frontend apenas, sem backend novo:

- [ ] `<canvas>` fullscreen com devicePixelRatio correto
- [ ] Ferramentas temporárias via teclado: `1` = caneta, `2` = borracha (sem toolbar ainda)
- [ ] Caneta: 1 cor fixa (ex. branco), 1 espessura fixa
- [ ] Pan: `Space + arrastar` · Zoom: `Scroll` (centrado no cursor)
- [ ] Texto simples: duplo-clique cria `<input>` posicionado, Enter confirma (sem markdown)
- [ ] Undo/redo: `Ctrl+Z` / `Ctrl+Shift+Z` com pilha em memória

**Done:** rabiscar 50 strokes sem lag perceptível, pan/zoom suaves, texto aparece onde clicou.

---

## L3 — Persistência local

**Objetivo:** fechar e reabrir sem perder nada.

- [ ] Modelo: `{ strokes: [{points, color, width}], texts: [{x, y, content}], camera: {x, y, zoom} }`
- [ ] Salvar com debounce (~500ms) em `%APPDATA%/Canvie/canvas.json` via comando Tauri ou `localStorage` como fallback inicial
- [ ] Carregar no boot e restaurar câmera
- [ ] Botão provisório no console para `Exportar / Limpar` (debug)

**Done:** matar o processo no Gerenciador de Tarefas, reabrir, canvas volta idêntico.

---

## L4 — Modos + atalhos globais

**Objetivo:** os 3 estados funcionam mesmo sem foco.

Plugins Tauri: `plugin-global-shortcut`

- [ ] `Ctrl + L` → Lock Mode: `setIgnoreCursorEvents(true)` — visível, sem interceptar clique/mouse
- [ ] `Ctrl + L` de novo → volta ao Canvas Mode: `setIgnoreCursorEvents(false)`
- [ ] `Win + T` → Overlay Mode: `setAlwaysOnTop(true)` + foco + `ignoreCursorEvents(false)`
- [ ] `Win + T` de novo ou `Esc` → volta ao estado anterior
- [ ] Indicador mínimo de estado (ex. pontinho no canto ou tooltip do tray)

**Done:** com Chrome em fullscreen, `Win+T` traz o canvas para cima, desenha, `Win+T` devolve. Com Lock ativo, cliques atravessam para os ícones/apps.

---

## L5 — Segundo plano (tray + autostart)

**Objetivo:** app invisível até ser chamado.

Plugins Tauri: `plugin-tray`, `plugin-autostart`, `plugin-single-instance`

- [ ] Tray icon (usar 🖼️ provisório) com menu: `Mostrar / Lock / Overlay / Sair`
- [ ] `singleInstance`: segundo clique foca em vez de abrir outro
- [ ] `autostart`: iniciar minimizado com o Windows (sem abrir janela de console)
- [ ] Fechar janela (X) = minimizar para tray, não sair. Sair só pelo tray.

**Done:** reinicia o Windows, Canvie sobe sozinho, sem janela pipocando, aparece no tray.

---

## L6 — Build instalável + primeiro teste na máquina

**Objetivo:** `.exe`/`.msi` instalável para teste real.

- [ ] Ícone provisório + nome `Canvie`, versão `0.0.1`, identifier `com.canvie.app`
- [ ] `npm run tauri build` → artefatos em `src-tauri/target/release/bundle/`
- [ ] Instalar o `.msi` (ou rodar o `.exe` portable) na máquina Windows
- [ ] Checklist de aceite do MVP-0:
  - [ ] Instala sem erro / abre em < 5s
  - [ ] Desenha + apaga + pan/zoom funcionam
  - [ ] `Ctrl+L` congela / descongela
  - [ ] `Win+T` traz para frente / manda para trás
  - [ ] Reinicia o Windows → canvas intacto + tray ativo
  - [ ] CPU/RAM em idle aceitáveis (meta: < 150MB RAM, ~0% CPU parado)
- [ ] Congelar tag: `git tag mvp-0-instalavel`

**Done:** build instalada na sua máquina passa em todos os itens acima.

---

## Pós-MVP-0 (não fazer agora)

Toolbar `Q`, 3 brush, paleta, setas/formas/cards, markdown com fontes, fundo sólido/transparente, imagens/clipboard, atalhos editáveis, `WorkerW` real abaixo dos ícones, Linux.

---

## Ordem de execução sugerida

```
L0 → L1 → L2 → L3 → L4 → L5 → L6
```

Regra: não avança de camada sem passar no `Done`. Se L1 travar no Windows (transparência/foco), resolve antes de desenhar qualquer feature.
