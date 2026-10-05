# Arquitetura de runtime

Este documento detalha o sistema de transição entre a Parede e a Edição. A visão do produto está em product.md e a ordem de construção está em docs/MVP-0-ROADMAP.md.

## Runtime

O Canvie usa um processo Tauri, uma janela WebView2 e um frontend React. O backend Rust controla janela, tray, atalhos e ciclo de vida. O frontend controla documento, desenho e toolbar.

    Usuário
      │
      ├── Ctrl + Alt + T / tray
      ▼
    lib.rs: PlacementState
      │ comandos e eventos
      ▼
    placement.ts ── persistence.ts ── Canvas.tsx
      │
      ▼
    wallpaper.rs ── Progman, foco, click-through e Z-order

## PlacementState

O backend é a única autoridade sobre a camada da janela:

    enum Placement {
      Wall,
      Edit
    }

    struct PlacementState {
      placement: Placement,
      embedded: bool,
      focused: bool,
      toolbar: ToolbarPlacement,
    }

ToolbarPlacement fica persistido como preferência, não como parte do documento.

O frontend recebe canvie-placement e espelha placement. Ele pode mostrar Salvando, mas não pode declarar que a janela está na Parede antes do evento do backend.

## Transições

### Wall → Edit

Fonte: Ctrl + Alt + T, tray Editar ou Show quando a janela está na Parede.

1. O backend verifica a janela principal.
2. O backend muda a propriedade de top-level, sempre no topo e foco.
3. O backend revalida estilo e relação da janela.
4. O backend mostra a janela, dá foco e emite Edit.
5. O frontend exibe dim, toolbar e os controles de edição.

Não há save nessa transição. O documento já está confirmado pela persistência anterior.

### Edit → Wall

Fonte: **Fixar no desktop**, Esc, Ctrl + Alt + T ou tray Fixar no desktop.

1. O botão e Esc entram direto neste fluxo. O atalho e o tray emitem canvie-pin-requested, que o frontend recebe e transforma neste mesmo fluxo.
2. O frontend bloqueia a ação duplicada e mostra Salvando.
3. persistence.ts chama saveNow e recebe sucesso ou erro.
4. Em caso de erro, o frontend desbloqueia a ação, mantém Edit e mostra Tentar novamente.
5. Em caso de sucesso, o frontend chama pin_to_wall.
6. O backend remove always-on-top, ativa click-through e reparenta no Progman.
7. O backend reaplica WS_CHILD e a ordem Z depois das chamadas tao.
8. O backend emite Wall.
9. O frontend esconde dim e toolbar.

O backend não aceita pin_to_wall com um payload de documento. O documento é responsabilidade do frontend e precisa estar salvo antes da mudança de camada.

## Janela do Windows

### Parede

wallpaper.rs localiza Progman e parenta a janela como filha. A janela fica acima de SHELLDLL_DefView para permanecer visível. O click-through permite que os eventos cheguem ao desktop.

### Edição

wallpaper.rs remove o parent, restaura o estilo de top-level e posiciona a janela como primeiro plano. O backend ativa foco e always-on-top somente durante Edição.

### Re-embed

Chamadas tao para always_on_top ou ignore_cursor_events podem alterar GWL_STYLE. Toda chamada desse tipo deve ser seguida por:

1. reaplicar WS_CHILD ou WS_POPUP conforme o destino;
2. reaplicar SetParent;
3. revalidar a ordem Z;
4. registrar o resultado.

Se o re-embed falhar, não emita Wall. Mantenha Edit para que o usuário não perca a rota de recuperação.

## Ponte

placement.ts expõe:

- getPlacement(): Promise<PlacementSnapshot>;
- enterEdit(): Promise<void>;
- pinToWall(): Promise<void>;
- onPlacementChanged(listener): Unsubscribe;
- onPinRequested(listener): Unsubscribe.

Cada wrapper usa invoke quando existe Tauri e um adapter em memória no navegador. O adapter permite testar desenho e toolbar sem Windows.

O tray e o atalho global nunca chamam pin_to_wall em Edit. Eles emitem canvie-pin-requested. O frontend salva e chama pin_to_wall.

## Capabilities

O primeiro conjunto de permissões cobre apenas os comandos de colocação, eventos e os plugins de global-shortcut, single-instance, autostart e tray. Uma capability não libera comandos não usados pela janela principal.

## Segurança e logs

Logs registram:

- startup e versão;
- atalho registrado ou recusado;
- Wall → Edit e Edit → Wall;
- falha de saveNow;
- falha de parent, foco, click-through ou re-embed;
- segunda instância e autostart.

Logs não registram o conteúdo do documento, clipboard, texto de notas ou caminhos pessoais.
