# Arquitetura

Este documento descreve a solução mínima para o Canvie. A implementação entra por camadas. L0 cria o processo Tauri, L1 cria o canvas e L2 persiste o documento; os nomes de arquivo abaixo continuam sendo o contrato para as próximas camadas.

## Escolha da stack

Use Tauri 2 com Rust, WebView2, React 19, TypeScript estrito e Canvas 2D.

Tauri mantém uma única janela WebView e um processo Rust pequeno. Rust concentra o ciclo de vida, o tray, os atalhos globais e a relação com o desktop do Windows. React desenha o canvas e a toolbar. Canvas 2D evita uma biblioteca de edição antes de existir uma necessidade medida.

Electron, um editor de canvas pronto e um serviço local separado aumentariam o uso de memória e o número de pontos de falha sem ajudar o primeiro fluxo.

## Processos e janelas

O app usa um processo Tauri e uma janela principal. A janela muda de relação com o Windows quando o usuário chama ou encerra a edição.

| Estado | Relação da janela | Entrada |
| --- | --- | --- |
| Parede (Fixo) | Janela do tamanho do monitor principal, filha de Progman, transparente fora da área, acima da camada de ícones e abaixo da taskbar e das janelas comuns | Click-through em toda a janela |
| Edição | A mesma janela, top-level, em primeiro plano, com foco e sempre no topo; o dim cobre o resto da tela | Interativa |

O Canvie não cria uma segunda janela para editar. A mesma janela é desanexada e reanexada. Isso reduz memória e evita dois documentos com estados diferentes.

Uma janela atrás de SHELLDLL_DefView não recebe os cliques do desktop. Por isso Parede fica elevada e libera a interação com click-through. A integração com Win32 fica concentrada em wallpaper.rs.

## A máquina de estados

O backend mantém uma única máquina de estados:

    Wall ── summon ──> Edit
    Wall <── pin ───── Edit

PlacementState tem:

- placement: Wall ou Edit;
- embedded: se a janela está parentada no Progman;
- focused: se a janela recebeu foco para editar.

ToolbarPlacement e last_saved_revision ficam no frontend. ToolbarPlacement é uma preferência persistida e last_saved_revision é a revisão confirmada pelo saver.

O frontend espelha placement por um evento canvie-placement. Ele não decide sozinho se a janela está na parede ou em edição.

O modo Salvando é um estado visual da transição no frontend. Ele não é uma terceira camada de janela. O backend só recebe o pedido de voltar para Wall depois que persistence.ts confirma a gravação.

## Fluxo de edição

1. Em Wall, o atalho global, o tray ou uma segunda abertura fazem Rust emitir canvie-edit-requested.
2. O frontend põe o canvas na pose de onde a entrada começa (invisível, 12 px abaixo), espera dois quadros e chama enter_edit. Sem resposta em 300 ms, Rust chama enter_edit sozinho.
3. Rust muda a janela para top-level, desativa click-through, aplica always-on-top, mostra a janela e dá foco.
4. Rust emite canvie-placement com Edit.
5. O frontend mostra a toolbar e o dim leve, e o canvas sobe com fade.
6. O usuário edita o documento.
7. O usuário clica em Fixar no desktop ou usa Esc. O atalho e o tray emitem canvie-pin-requested quando o estado atual é Edit.
8. O frontend entra em Salvando e executa saveNow.
9. Se saveNow falhar, o frontend continua em Edit e mostra Tentar novamente.
10. Se saveNow passar, o canvas desce com fade, e no fim da animação o frontend chama pin_to_wall.
11. Rust limpa always-on-top, reativa click-through, reparenta a janela e reeleva a camada.
12. Rust emite canvie-placement com Wall. O frontend esconde a toolbar, e o canvas pousa com fade.

A janela, ao subir, mostra o último quadro que desenhou. Por isso o frontend desenha a pose de entrada antes de enter_edit: sem ela, o canvas do desktop piscaria à frente das outras janelas por um ou dois quadros. O estado continua só no backend; o frontend apenas escolhe o momento de pedir.

O atalho Ctrl + Alt + T e o tray usam canvie-pin-requested durante Edit. Nenhum deles chama pin_to_wall diretamente, porque o backend não conhece a revisão em memória do frontend.

## Fluxo de inicialização

1. O processo registra single-instance e log.
2. Rust cria a janela do tamanho do monitor principal, parenta no Progman, ativa click-through e mantém a área na camada do desktop; depois cria o tray e registra o atalho global.
3. O frontend carrega e valida o documento local e renderiza a área.
4. O frontend assina canvie-placement e só então lê get_placement.
5. O estado inicial do backend é sempre Wall. O app não abre uma edição pendente depois de um reinício. Sem área salva, o frontend pede enter_edit uma vez, para o primeiro arraste.

Se o Explorer reiniciar, o Progman some e destrói a janela junto, com a WebView. Desde a L6, um watchdog no backend espera o novo desktop e reinicia o Canvie, que volta ao Progman com o documento salvo. O detalhe está em [docs/BACKEND.md](docs/BACKEND.md#reinício-do-explorer).

## Ownership

| Área | Dono | Responsabilidade |
| --- | --- | --- |
| Documento e histórico | frontend/src/canvas e frontend/src/App.tsx | Área, desenho, notas em Markdown, post-its, câmera, ações, undo e redo |
| Persistência | frontend/src/persistence.ts | Validação, load, save com debounce, saveNow e backup de documento inválido |
| Ponte de colocação | frontend/src/placement.ts | Wrappers tipados, eventos e fallback para o navegador |
| Estado de janela | frontend/src-tauri/src/lib.rs | PlacementState, comandos, eventos, tray, ciclo de vida e atalhos |
| Windows | frontend/src-tauri/src/wallpaper.rs | Progman, estilos, transparência, click-through, foco, Z-order e re-embed |
| Permissões | frontend/src-tauri/capabilities | Exposição mínima de comandos e plugins |
| Aparência | frontend/src/App.css e frontend/src/index.css | Página transparente, fundo da área, notas, dim, toolbar e estados de foco |

Nenhum componente React chama diretamente a API de janela. Nenhuma função de Win32 interpreta traços ou notas.

## Persistência

O documento local usa a forma:

    CanvasDoc {
      version: 2,
      revision: number,
      area: { x, y, width, height } | null,
      background: 'paper' | 'white' | 'black' | 'yellow' | 'transparent',
      strokes: Stroke[],
      notes: Note[],
      camera: { x: number, y: number, zoom: number }
    }

Traços guardam o pincel. Notas e post-its guardam Markdown, tamanho, fonte, alinhamento e tipo. A área usa pixels CSS da janela, que cobre o monitor principal a partir da L4. O documento fica na chave `canvie.document`; um documento v1 da 0.0.1 é migrado na carga e fica intocado na chave antiga como cópia ([0011](decisions/0011-document-v2-storage.md)).

O WebView2 localStorage é suficiente para o primeiro ciclo e evita uma API Rust de arquivo. lib.rs cria a janela principal com o perfil do WebView2 em %APPDATA%/com.canvie.app, ao lado do resto dos dados do usuário. O padrão do Tauri e o dataDirectory relativo resolvem para %LOCALAPPDATA%. persistence.ts:

- valida a versão e cada campo antes de renderizar e antes de gravar;
- carrega um documento vazio quando o conteúdo é inválido;
- guarda uma cópia do texto inválido para diagnóstico local;
- desliga o save da sessão quando não consegue ler o documento salvo ou guardar essa cópia;
- salva depois de uma pausa de 350 ms e grava o save pendente quando a página fica oculta;
- oferece saveNow para Fixar no desktop;
- nunca substitui um documento válido por um payload que não passou pela validação.

O estado do documento é local. O log nunca inclui texto, traços, clipboard ou caminhos pessoais.

## Tauri e permissões

Os comandos iniciais são:

- get_placement;
- enter_edit;
- pin_to_wall.

Cada comando precisa de uma função tauri::command, registro no handler, permissão mínima na capability e wrapper TypeScript com fallback de navegador.

O plugin global-shortcut registra Ctrl + Alt + T. O plugin single-instance foca a instância existente. O plugin autostart aponta para o executável instalado.

Uma falha de permissão ou de registro deixa o app iniciado. O log explica a degradação e o tray mantém a rota para Edição.

## Invariantes do Windows

- Depois de qualquer chamada tao que mude always_on_top, ignore_cursor_events ou a visibilidade, reaplique parent, WS_CHILD e Z-order.
- Toda janela com WS_EX_LAYERED recebe SetLayeredWindowAttributes; sem os atributos, o Windows não a desenha.
- Parede usa a relação Progman testada. Não use WorkerW, hooks do Explorer ou alterações em DefView.
- Parede é click-through. Não tente receber edição atrás da camada de ícones.
- Edição é top-level e focada. Ao sair, ela volta para Progman antes de emitir Wall.
- html, body, #root e a janela Tauri permanecem transparentes quando o estado é Parede.
- O processo não roda elevado.
- O segundo lançamento foca a instância existente e encerra.

## Desempenho

O app mantém uma única WebView, renderiza um Canvas 2D e fica ocioso sem loop de animação. O desenho usa requestAnimationFrame apenas enquanto existe alteração ou interação.

Meça o working set e o uso de CPU em uma build instalada após 60 segundos na Parede e durante 60 segundos em Edição. A meta inicial é no máximo 150 MB em repouso e uso de CPU próximo de 0% em Parede. O número observado entra em docs/OPERATIONS.md.
