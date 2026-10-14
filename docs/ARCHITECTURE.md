# Arquitetura de runtime

Este documento detalha o sistema de transição entre o estado Fixo (Wall) e a Edição. A visão do produto está em product.md e a ordem de construção está em docs/MVP-0-ROADMAP.md.

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

    struct PlacementSnapshot {
      placement: Placement,
      embedded: bool,
    }

PlacementState guarda o snapshot e uma flag `moving` que recusa um segundo pedido durante uma transição. A posição da toolbar não faz parte do placement; salvar a posição, como pede a decisão 0004, ainda não foi entregue.

O frontend recebe canvie-placement e espelha placement. Ele pode mostrar Salvando, mas não pode declarar que a janela está na Parede antes do evento do backend.

## Transições

### Wall → Edit

Fonte: Ctrl + Alt + T, Editar ou clique no ícone do tray, segunda abertura do app ou primeira abertura sem área.

1. O backend tira o parent Progman e restaura WS_POPUP (`wallpaper::detach`).
2. O tao desliga o click-through e liga always-on-top.
3. `wallpaper::bring_to_front` cobre o monitor principal como HWND_TOPMOST e pede o foreground, depois das chamadas tao.
4. O backend foca a janela e emite Edit.
5. O frontend exibe dim, borda, toolbar e os controles de edição.

Não há save nessa transição. O documento já está confirmado pela persistência anterior.

### Edit → Wall

Fonte: **Fixar no desktop**, Esc, Ctrl + Alt + T, Alt + F4 ou tray Fixar no desktop.

1. O botão e Esc entram direto neste fluxo. O atalho e o tray emitem canvie-pin-requested, e o pedido de fechamento da janela (Alt + F4) emite canvie-close-requested. O frontend transforma os dois neste mesmo fluxo; sem área, o fechamento chama quit_app e encerra o app.
2. O frontend bloqueia a ação duplicada, conclui a nota em edição pelo blur e mostra Salvando.
3. persistence.ts chama saveNow e recebe sucesso ou erro.
4. Em caso de erro, o frontend desbloqueia a ação, mantém Edit e mostra Tentar novamente.
5. Em caso de sucesso, o frontend chama pin_to_wall.
6. O backend remove always-on-top, ativa click-through e mostra a janela pelo tao.
7. `wallpaper::embed` aplica os atributos de layer, WS_CHILD, o parent Progman e a ordem Z depois das chamadas tao.
8. O backend emite Wall. Se o embed falhar, a janela volta para Edit e pin_to_wall devolve erro.
9. O frontend esconde dim e toolbar.

O backend não aceita pin_to_wall com um payload de documento. O documento é responsabilidade do frontend e precisa estar salvo antes da mudança de camada.

## Janela do Windows

### Parede

wallpaper.rs localiza Progman e parenta a janela como filha, cobrindo o monitor principal. A janela fica à frente de SHELLDLL_DefView para permanecer visível sobre os ícones, e só a área é pintada. O click-through (WS_EX_LAYERED e WS_EX_TRANSPARENT) deixa os cliques chegarem ao desktop; os atributos de layer fazem o Windows desenhar a janela.

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

- getPlacement(): Promise<PlacementSnapshot | null>;
- enterEdit(): Promise<void>;
- pinToWall(): Promise<void>;
- onPlacementChanged(listener): Subscription, com `ready` e `unsubscribe`;
- onPinRequested(listener): Unsubscribe;
- onCloseRequested(listener): Unsubscribe;
- quitApp(): Promise<void>, só para um fechamento antes de existir uma área.

Cada wrapper usa invoke quando existe Tauri e um adapter em memória no navegador. O adapter permite testar desenho e toolbar sem Windows. O App lê getPlacement só depois de `ready`: um evento emitido antes de o listener existir se perde, e a primeira abertura pede enter_edit logo no boot.

O tray e o atalho global nunca chamam pin_to_wall em Edit. Eles emitem canvie-pin-requested. O frontend salva e chama pin_to_wall.

## Capabilities

A capability da janela principal concede só allow-get-placement, allow-enter-edit, allow-pin-to-wall, allow-quit-app, allow-report-frontend-issue, core:event:allow-listen e core:event:allow-unlisten. Global-shortcut, single-instance e tray rodam no Rust e não expõem comandos à WebView. O AppManifest em build.rs faz cada comando do app depender de permissão explícita.

## Segurança e logs

Logs registram:

- startup e versão;
- atalho registrado ou recusado;
- Wall → Edit e Edit → Wall;
- falha de save, documento recuperado e salvamento desativado, que o frontend envia por report_frontend_issue como códigos fixos;
- Alt + F4 em Edit e o encerramento sem área, a janela perdida ou fora do Progman, o reinício pelo watchdog e o fechamento que encerra o app;
- falha de parent, foco, click-through ou re-embed;
- segunda instância.

Logs não registram o conteúdo do documento, clipboard, texto de notas ou caminhos pessoais.
