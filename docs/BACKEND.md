# Backend

O backend Tauri inicia o processo, registra o log e mantém a instância única do scaffold L0. Desde a L2, ele cria a janela principal no setup a partir da configuração `main` (com `create: false`) para fixar o perfil do WebView2, e com ele o localStorage do documento, em %APPDATA%/com.canvie.app. Se a pasta não puder ser resolvida, o app usa o perfil padrão e registra um aviso. Ele não desenha elementos do canvas. Os comandos de placement entram na L3 e na L4.

## Arquivos

| Arquivo | Dono |
| --- | --- |
| src/lib.rs | PlacementState, comandos, eventos, tray, atalhos e ciclo de vida |
| src/wallpaper.rs | Progman, parent, estilos, click-through, foco, transparência e Z-order |
| src/main.rs | Entrada da aplicação |
| build.rs | Manifesto de comandos e permissões |
| capabilities/default.json | Capability mínima da janela principal |

## Comandos

O conjunto inicial é:

- get_placement;
- enter_edit;
- pin_to_wall.

Cada comando tem retorno tipado e log de falha. pin_to_wall só trata a janela. Ele não grava o documento.

## PlacementState

PlacementState guarda o estado efetivo da janela:

    PlacementState {
      placement: Wall | Edit,
      embedded: bool,
      focused: bool
    }

O estado nasce em Wall. Toda transição passa por uma função central e emite canvie-placement depois de concluir a operação da janela.

## Atalho e tray

O plugin global-shortcut registra Ctrl + Alt + T. Se o registro falhar, o app inicia, registra warn e mantém Editar no tray.

O tray oferece:

- Editar;
- Fixar no desktop, que emite canvie-pin-requested durante Edit;
- Mostrar;
- Sair.

O tray chama enter_edit diretamente em Wall. Em Edit, o tray e o atalho global emitem canvie-pin-requested para o frontend. O frontend salva e chama pin_to_wall. Não existe uma terceira regra de transição.

## wallpaper.rs

Funções previstas:

- find_progman;
- embed_wall;
- detach_for_edit;
- set_click_through;
- set_foreground;
- raise_wall;
- reapply_window_style.

Parede parenta em Progman e usa click-through. Edição desanexa, recebe foco e fica sempre no topo. O retorno aplica estilo, parent e Z-order depois de cada chamada tao que possa reescrever GWL_STYLE.

Não use WorkerW, hooks do Explorer ou DefView patching.

## Ciclo de vida

- single-instance registra primeiro e foca a instância existente;
- fechar a janela impede close e esconde para o tray;
- Sair encerra o processo;
- autostart aponta para o executável instalado;
- Explorer reiniciado é detectado indiretamente: o próximo comando de janela repete embed_wall.

## Logs

Registre startup, hotkey, tray, mudança de placement, re-embed, foco, click-through, autostart, segunda instância e falha de comando. Não registre conteúdo do canvas.
