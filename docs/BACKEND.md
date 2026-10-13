# Backend

O backend Tauri inicia o processo, registra o log e mantém a instância única do scaffold L0. Ele cria a janela principal no setup a partir da configuração `main` (com `create: false`) para fixar o perfil do WebView2, e com ele o localStorage do documento, em %APPDATA%/com.canvie.app (L2). Se a pasta não puder ser resolvida, o app usa o perfil padrão e registra um aviso. Desde a L4, a mesma janela nasce invisível, sem bordas, sem taskbar e sem sombra, e fica Fixa no desktop. Ele não desenha elementos do canvas. A transição para Edit entra na L5.

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

build.rs declara os comandos no AppManifest, então nenhum comando fica aberto sem a permissão na capability. A capability também concede `core:event:allow-listen` e `core:event:allow-unlisten` para o evento canvie-placement. Cada comando tem retorno tipado e log de falha. pin_to_wall só trata a janela. Ele não grava o documento.

## PlacementState

PlacementState guarda o estado efetivo da janela:

    PlacementSnapshot {
      placement: 'wall' | 'edit',
      embedded: bool
    }

O estado nasce em Wall. Toda transição passa por uma função central, grava o snapshot e emite canvie-placement depois de concluir a operação da janela. O frontend lê o mesmo snapshot por get_placement no boot.

## Atalho e tray

O plugin global-shortcut registra Ctrl + Alt + T. Se o registro falhar, o app inicia, registra warn e mantém Editar no tray.

O tray oferece:

- Editar;
- Fixar no desktop, que emite canvie-pin-requested durante Edit;
- Sair.

O tray chama enter_edit diretamente em Wall. Em Edit, o tray e o atalho global emitem canvie-pin-requested para o frontend. O frontend salva e chama pin_to_wall. Não existe uma terceira regra de transição.

## wallpaper.rs

Funções:

- `primary_monitor`: retângulo do monitor principal em pixels físicos;
- `embed`: aplica os atributos de layer, define WS_CHILD, parenta em Progman, cobre o monitor principal e coloca a janela à frente dos filhos de Progman, acima da camada de ícones;
- `is_embedded`: confere se o parent atual é o Progman.

Wall chama, nesta ordem, set_always_on_top(false), set_ignore_cursor_events(true) e show() do tao, e só então `embed`. Cada chamada do tao reescreve GWL_STYLE a partir das flags do próprio tao e remove WS_CHILD, por isso o embed vem por último. O click-through do tao liga WS_EX_LAYERED e WS_EX_TRANSPARENT, mas não chama SetLayeredWindowAttributes; uma janela layered sem atributos não é desenhada. `embed` aplica alfa 255 antes de reparentar.

Se o Progman não existir ou o embed falhar, a janela fica top-level, transparente e click-through, e o log registra `placement -> wall degraded`.

Não use WorkerW, hooks do Explorer ou DefView patching.

## Ciclo de vida

- single-instance registra primeiro e foca a instância existente;
- Sair encerra o processo;
- uma janela filha de Progman pode ser destruída junto com o Progman quando o Explorer reinicia; a recriação da janela fica para a L6.

## Logs

Registre startup, hotkey, tray, mudança de placement, re-embed, foco, click-through, segunda instância e falha de comando. Não registre conteúdo do canvas.
