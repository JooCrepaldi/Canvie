# Backend

O backend Tauri inicia o processo, registra o log e mantém a instância única do scaffold L0. Ele cria a janela principal no setup a partir da configuração `main` (com `create: false`) para fixar o perfil do WebView2, e com ele o localStorage do documento, em %APPDATA%/com.canvie.app (L2). Se a pasta não puder ser resolvida, o app usa o perfil padrão e registra um aviso. Desde a L4, a mesma janela nasce invisível, sem bordas, sem taskbar e sem sombra, e fica Fixa no desktop. A L5 entregou a transição para Edit, o atalho global e o tray. A L6 entregou Alt + F4 em Edit, a volta ao desktop depois de um reinício do Explorer e as falhas do frontend no log. Ele não desenha elementos do canvas.

## Arquivos

| Arquivo | Dono |
| --- | --- |
| src/lib.rs | PlacementState, comandos, eventos, tray, atalhos e ciclo de vida |
| src/wallpaper.rs | Progman, parent, estilos, atributos de layer, monitor principal e Z-order |
| src/main.rs | Entrada da aplicação |
| build.rs | Manifesto de comandos do app, que exige permissão para cada comando |
| capabilities/default.json | Capability mínima da janela principal |

## Comandos

| Comando | Camada | Permissão |
| --- | --- | --- |
| get_placement | L4 | allow-get-placement |
| enter_edit | L5 | allow-enter-edit |
| pin_to_wall | L5 | allow-pin-to-wall |
| quit_app | L6 | allow-quit-app |
| report_frontend_issue | L6 | allow-report-frontend-issue |

build.rs declara os comandos no AppManifest, então nenhum comando fica aberto sem a permissão na capability. A capability também concede `core:event:allow-listen` e `core:event:allow-unlisten` para o evento canvie-placement. Cada comando tem retorno tipado e log de falha. pin_to_wall só trata a janela. Ele não grava o documento.

## PlacementState

PlacementState guarda o estado efetivo da janela:

    PlacementSnapshot {
      placement: 'wall' | 'edit',
      embedded: bool
    }

O estado nasce em Wall. Toda transição passa por enter_edit_now ou pin_now, que gravam o snapshot e emitem canvie-placement depois de concluir a operação da janela. O frontend lê o mesmo snapshot por get_placement no boot.

Comandos, atalho, tray e single-instance rodam na thread principal, e mover a janela processa mensagens do Windows. Por isso uma flag `moving`, e não uma trava mantida durante a transição, recusa um segundo pedido no meio de outro, sem deadlock.

Se o embed falhar ao fixar, pin_to_wall devolve erro e a janela volta para Edit: um Wall sem Progman deixaria uma janela click-through sem rota de volta.

## Atalho e tray

O plugin global-shortcut registra Ctrl + Alt + T no Rust, sem permissão para a WebView. Se o registro falhar, o app inicia, registra warn e mantém Editar no tray.

O tray oferece:

- Editar;
- Fixar no desktop, que emite canvie-pin-requested durante Edit;
- Reposicionar toolbar, que chama enter_edit e emite canvie-toolbar-reset, para o frontend apagar a posição salva;
- Sair.

O clique esquerdo no ícone do tray alterna como o atalho; o menu abre com o clique direito. O tray chama enter_edit diretamente em Wall. Em Edit, o tray e o atalho global emitem canvie-pin-requested para o frontend. O frontend salva e chama pin_to_wall. Não existe uma terceira regra de transição.

## wallpaper.rs

Funções:

- `primary_monitor`: retângulo do monitor principal em pixels físicos;
- `embed`: aplica os atributos de layer, define WS_CHILD, parenta em Progman, cobre o monitor principal e coloca a janela à frente dos filhos de Progman, acima da camada de ícones;
- `is_embedded`: confere se o parent atual é o Progman;
- `is_alive`: confere por IsWindow se o HWND ainda existe;
- `desktop`: diz se o Progman existe e se a camada de ícones (SHELLDLL_DefView) já está nele;
- `detach`: tira o parent e troca WS_CHILD por WS_POPUP;
- `bring_to_front`: cobre o monitor principal como HWND_TOPMOST e pede o foreground.

Edit chama `detach`, depois set_ignore_cursor_events(false) e set_always_on_top(true) do tao, depois `bring_to_front` e set_focus. O detach vem antes para o tao aplicar as flags a uma janela top-level.

Wall chama, nesta ordem, set_always_on_top(false), set_ignore_cursor_events(true) e show() do tao, e só então `embed`. Cada chamada do tao reescreve GWL_STYLE a partir das flags do próprio tao e remove WS_CHILD, por isso o embed vem por último. O click-through do tao liga WS_EX_LAYERED e WS_EX_TRANSPARENT, mas não chama SetLayeredWindowAttributes; uma janela layered sem atributos não é desenhada. `embed` aplica alfa 255 antes de reparentar.

Na abertura, se o Progman não existir ou o embed falhar, a janela fica top-level, transparente e click-through, e o log registra `placement -> wall degraded`.

Não use WorkerW, hooks do Explorer ou DefView patching.

## Ciclo de vida

- single-instance registra primeiro; a segunda abertura encerra e traz a área da primeira para Edit;
- Sair marca `Lifecycle` como encerrando e termina o processo; um save ainda no debounce de 350 ms pode se perder;
- Alt + F4, ou qualquer WM_CLOSE, em Edit não fecha a janela: o backend emite canvie-close-requested, porque só o frontend sabe se existe uma área. Com área, o frontend salva e fixa, como em Fixar no desktop. Sem área, não há o que fixar: o frontend grava o save pendente e chama quit_app, que encerra o app como Sair;
- WM_CLOSE em Wall encerra o app, como Sair. Em Wall a janela não tem foco, então só um programa manda esse pedido.

### Reinício do Explorer

Quando o Explorer reinicia, o Progman some e leva a janela filha junto. O E2E da L6 mediu os dois casos com o Explorer real:

- **queda do Explorer:** o Windows destrói a janela sem mandar WM_DESTROY. O tao e o Tauri continuam com a janela registrada, mas o HWND está morto, e cada evento para a WebView morta gera um ERROR no log;
- **saída normal do Explorer:** a janela recebe WM_DESTROY, e o Tauri a remove.

Nos dois casos a WebView morre com a janela, e o Tauri não deixa criar outra janela `main` enquanto a morta continua registrada. Por isso o backend reinicia o Canvie. Em Wall o documento já está salvo, então o reinício perde só o histórico da sessão.

Um watchdog, numa thread própria, confere o estado uma vez por segundo. Ele encontra uma de duas perdas, e só age quando duas checagens seguidas a confirmam:

- **janela perdida:** a janela não existe mais ou `IsWindow` diz que o HWND morreu. Vale em qualquer placement;
- **parent perdido:** a janela está viva, num Wall fora de transição, mas não é filha do Progman. É o caso de um Wall que abriu antes do Explorer.

Então o watchdog:

1. registra uma vez `wall: the window is gone` ou `wall: the window is outside Progman`;
2. espera o Progman e a camada de ícones (SHELLDLL_DefView). Um app de wallpaper pode tirar os ícones do Progman, então depois de 10 checagens sem eles o watchdog continua mesmo assim;
3. com a janela perdida, registra `restarting Canvie on the new desktop` e chama `request_restart`. O single-instance libera a trava no `RunEvent::Exit`, antes de o Tauri abrir o processo novo;
4. com o parent perdido, refaz o Wall na thread principal, com a flag `moving`, por `settle_on_wall`, e publica o snapshot. Se o embed falhar, tenta de novo com espera dobrada, até 300 checagens.

Quando a última janela é destruída, o Tauri pede para sair sem código. Se `Lifecycle` não estiver encerrando, o backend impede a saída e o processo espera no tray até o watchdog reiniciá-lo.

## Logs

Registre startup com a versão, hotkey, tray, mudança de placement, re-embed, foco, click-through, segunda instância, falha de comando, Alt + F4 em Edit e o encerramento sem área, a janela perdida ou fora do Progman, o reinício pelo watchdog e o fechamento que encerra o app. As falhas de persistência do frontend e a posição inválida da toolbar chegam por report_frontend_issue, que aceita só um código fixo. Não registre conteúdo do canvas.
