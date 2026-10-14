# Operação

Esta página define a verificação que acompanha cada camada. O scaffold L0, o canvas L1 e o documento persistente L2 já estão no repositório.

## Comandos

Execute na pasta que possui o script:

    Set-Location frontend
    npm install
    npm run build
    npx oxlint
    Set-Location src-tauri
    $env:CARGO_BUILD_JOBS = "1"
    cargo check

Para a build instalada:

    Set-Location frontend
    npm run tauri build

Desde a L7, essa build também gera o instalador NSIS por usuário em `%LOCALAPPDATA%\canvie-target\release\bundle\nsis`. A configuração está em `bundle` no tauri.conf.json: `installMode: currentUser`, idioma português do Brasil, sem elevação. O instalador nunca entra no Git.

O target do Rust deve ficar fora do OneDrive. Use CARGO_BUILD_JOBS=1 nesta máquina.

Um rustc que termina com `0xc0000409, STATUS_STACK_BUFFER_OVERRUN` aqui é falta de memória do LLVM: o log mostra `rustc-LLVM ERROR: out of memory` logo antes. A máquina tem 6 GB. Feche outros servidores de desenvolvimento e páginas pesadas e rode o build de novo; o Cargo reaproveita os crates já compilados.

Os E2E das camadas rodam depois de `npm run tauri build`, um de cada vez, porque usam a mesma porta de DevTools e a instância única:

    Set-Location frontend
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l2-persistence.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l3-area-content.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l4-fixed-area.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l5-transition.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l6-lifecycle.ps1

A L7 roda na build instalada. `l7-install.ps1` instala o instalador mais recente em modo silencioso, abre o Canvie pelo atalho do menu Iniciar com o perfil real, só para abrir e fechar, desinstala e instala de novo. As outras suítes aceitam `-Exe` para rodar no executável instalado:

    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l7-install.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l7-installed.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l2-persistence.ps1 -Exe "$env:LOCALAPPDATA\Canvie\canvie.exe"

A L8 prova a migração com um documento real gravado por uma build anterior à L8. Por padrão, essa build é o Canvie instalado pela L7; `-LegacyExe` aponta para outra:

    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l8-document-v2.ps1

Desde a L8, as suítes leem o documento em `canvie.document` e a cópia de payload inválido em `canvie.document.invalid`.

A L9 prova a Seleção, a Mão e o duplo clique:

    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l9-selection-hand.ps1

Desde a L9, Edição começa em Seleção. As suítes escolhem o Pincel com `chooseTool(page, 'Pincel')` antes de desenhar e voltam à Seleção com `selectionMode(page)`. As duas usam as letras das ferramentas, que funcionam mesmo com o seletor de área cobrindo a tela.

A L10 e a L11 provam o menu do botão direito e a toolbar nova:

    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l10-l11-menu-toolbar.ps1

Desde a L11, as suítes leem a ferramenta ativa em `.toolbar[data-tool]` com `activeTool(page)`. As tintas ficam no popover do Pincel, e `chooseInk(page, 'Tinta azul')` abre o popover quando preciso. Tema e Redefinir área ficam no menu, e `menuAction(page, 'Redefinir área')` abre o menu com o botão direito real e clica no item. Com o Pincel, o primeiro Esc fecha o popover e o segundo fixa.

A L12 prova as fontes, os seis tamanhos, o marca-texto e as seis tintas, e a leitura de uma tinta em cada tema:

    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l12-preset-values.ps1

O E2E da L6 reinicia o Windows Explorer duas vezes, por queda e por saída normal, com `scripts/e2e/lib/restart-explorer.ps1`. Isso fecha as janelas abertas do Explorer de Arquivos e faz a taskbar piscar. Na saída normal, o script inicia o Explorer de novo com o ambiente de usuário criado por CreateEnvironmentBlock, para o shell não herdar as variáveis do terminal. Rode a suíte só com o computador livre e com o consentimento de quem usa a máquina. `-SkipExplorer` roda todo o resto sem reiniciar o shell, para repetir a suíte depois de uma mudança que não toca o watchdog.

Com a L6, um WM_CLOSE em Edição salva e fixa em vez de encerrar. `CanvieApp.stop('close')` espera o app fixar ou encerrar. Se ele fixou, manda um segundo WM_CLOSE, que encerra o processo em Wall. Sem área, o primeiro WM_CLOSE já encerra.

Cada script abre o executável release com o perfil do WebView2 redirecionado para uma pasta temporária e confirma o redirecionamento antes de qualquer escrita. O canvas real do usuário não é lido nem alterado. Ele dirige a página pelo protocolo DevTools com input real de mouse e teclado. Os E2E da L4 e da L6 leem o estado Win32 da janela por `scripts/e2e/lib/win32-probe.ps1` e nunca movem as janelas do usuário. Screenshots e `report.json` ficam na pasta de evidência impressa no fim.

## Evidência por camada

| Camada | Evidência |
| --- | --- |
| L0 | build frontend, oxlint, cargo check e janela vazia |
| L1 | gravação manual de traço e nota no browser e na janela Tauri |
| L2 | `scripts/e2e/l2-persistence.ps1`: fechar processo e recuperar o mesmo documento; JSON inválido não derruba o app; falha de gravação mantém a sessão |
| L3 | `scripts/e2e/l3-area-content.ps1`: área por arraste, três tintas, Markdown, post-it, mover, apagar, fundo e reabertura |
| L4 | parent Progman, click-through, transparência fora da área, acesso normal ao desktop e memória em repouso |
| L5 | `scripts/e2e/l5-transition.ps1`: atalho real, Wall → Edit → Wall no log, save antes de pin, Esc, falha de save e segunda instância |
| L6 | Alt + F4 sem encerrar, segunda instância e logs de persistência |
| L7 | instalador, reinício do Windows, escala DPI, teclado, RAM e CPU |

## Evidência registrada em 2026-10-05

- L0: `npm run build`, `npx oxlint` e `cargo check --locked` passaram. A build release com símbolos desligados passou e registrou `Canvie startup`. Uma segunda abertura manteve um único processo `canvie`.
- L0: `npm run tauri dev` ainda não abre uma janela nesta máquina porque o `rustc` cai ao compilar o crate `windows` no perfil dev com `STATUS_STACK_BUFFER_OVERRUN`, que é falta de memória do LLVM (ver Comandos). A build release passa; a janela nativa não pôde ser inspecionada visualmente porque o processo iniciado pelo terminal não expõe uma janela na sessão interativa do agente.
- L1: no browser fallback, a prova manual criou um traço, desfez, refez, criou a nota `Ideia rápida`, apagou o traço, moveu a toolbar pelo pegador e moveu/ampliou a câmera. A prova de 50 traços fica para o fechamento da camada.

## Evidência registrada em 2026-10-13

`scripts/e2e/l2-persistence.ps1` passou 39 de 39 verificações na build release, em uma janela de 900 × 600:

- L1: 50 traços, uma nota digitada, borracha, Ctrl + Z, Ctrl + Y, pan pela ferramenta Mover e dois passos de zoom geraram exatamente a revisão 57, com 49 traços, a nota e a câmera salvas. Digitar `teste` na nota não trocou de ferramenta.
- L2, matar o processo: `taskkill /F` no `canvie.exe` e uma nova abertura recuperaram o documento idêntico, caractere por caractere, e o mesmo desenho. O WebView2 encerrou cerca de 0,6 s depois do processo. O traço seguinte recebeu o id 52, acima do maior id restaurado (51).
- L2, editar durante um save: com um documento de 600 traços e 2,3 milhões de caracteres, 12 traços desenhados enquanto os saves disparavam foram todos mantidos (revisão 1012), sem nenhuma long task do navegador. Serializar, gravar e reler esse documento custou cerca de 16 ms.
- L2, JSON inválido: JSON truncado, versão futura com 2 MB, ids duplicados e zoom fora da faixa abriram um canvas vazio com o aviso de recuperação, sem derrubar o processo. A cópia em `canvie.document.invalid.v1` e a chave principal ficaram idênticas ao payload até a primeira edição.
- L2, falha de gravação: com o localStorage cheio, o save mostrou Não foi possível salvar, manteve o último documento válido gravado e a edição em memória. Tentar novamente gravou as duas edições pendentes depois que o espaço voltou.
- L2, fechar a janela: um WM_CLOSE enviado logo depois de um traço, antes do debounce, preservou o traço.
- L2, perfil: sem variáveis de teste, o WebView2 abriu com `--user-data-dir` em `%APPDATA%\com.canvie.app\EBWebView`.
- O log release registrou um `Canvie startup` por abertura (13) e nenhuma linha de erro.
- Abertura até o canvas pronto: entre 0,85 s e 1 s com o perfil já criado.

## Evidência registrada em 2026-10-13: L3

`scripts/e2e/l3-area-content.ps1` passou 27 de 27 verificações na build release, em uma janela comum de 900 × 600:

- A primeira abertura mostrou o seletor de área; um arraste de 50 × 50 foi recusado com o aviso de tamanho mínimo; o arraste de 720 × 440 virou a área salva e desenhada.
- Um traço em cada tinta salvou as cores preta, azul e vermelha, e a tinta ativa ficou marcada como pressionada.
- Uma nota em Markdown guardou o texto bruto e renderizou título e tabela. `<img onerror>` e um link `javascript:` apareceram como texto, sem elemento de imagem ou link.
- Um post-it grande foi criado sem perder o foco ao trocar o tamanho, editado por duplo clique, e a borracha o removeu; Ctrl + Z o trouxe de volta.
- A ferramenta Mover arrastou uma nota exatamente pela distância do ponteiro.
- O fundo trocou para transparente e voltou para bege, com a cor calculada da área conferida.
- A ação Área foi cancelada com Esc e depois redefiniu o retângulo sem perder conteúdo.
- Matar o processo e abrir de novo trouxe o mesmo documento, a mesma área, as duas notas, a tabela e os traços.

`scripts/e2e/l2-persistence.ps1`, adaptado à área, passou 41 de 41 verificações na mesma build, incluindo um documento salvo antes da L3, sem área, que caiu no fluxo de documento inválido. O markdown-it aumentou o bundle em 105 KB minificado (43 KB com gzip).

## Evidência registrada em 2026-10-13: L4

`scripts/e2e/l4-fixed-area.ps1` passou 16 de 16 verificações na build release, num monitor de 1920 × 1080 a 100%:

- O backend respondeu `get_placement` com Wall e `embedded: true`, e o log registrou `placement -> wall (embedded in Progman)`.
- A janela é filha de Progman, com WS_CHILD, a primeira entre os filhos de Progman (acima da camada de ícones), WS_EX_LAYERED e WS_EX_TRANSPARENT, sem WS_EX_TOPMOST, cobrindo 1920 × 1080.
- O estado Fixo desenhou a área salva sem toolbar, borda, dim ou aviso; html, body, #root e main ficaram transparentes.
- O hit-test dentro e fora da área caiu na janela de outro app que estava por cima, e não no Canvie; a área não ficou com o foreground.
- Em repouso por 20 s: 356 MB de working set somando o `canvie.exe` e os 6 processos do WebView2, e 0,15 s de CPU por minuto.

A primeira execução com o desktop à mostra encontrou um defeito: a área não aparecia no desktop, embora o hit-test chegasse à camada de ícones. O click-through do tao liga WS_EX_LAYERED sem SetLayeredWindowAttributes, e o Windows não desenha uma janela layered sem atributos. Aplicar alfa 255 por fora fez a área bege e o post-it aparecerem sobre o wallpaper, transparentes em volta, e o clique continuou chegando a SHELLDLL_DefView; tirar WS_EX_LAYERED mostrou a área, mas quebrou o click-through. `wallpaper::embed` passou a aplicar os atributos. O E2E só confere o pixel bege quando encontra uma região de pelo menos 240 × 160 do desktop sem janelas por cima, para não mexer nas janelas do usuário; nesta execução, a tela estava toda coberta.

## Evidência registrada em 2026-10-13: L5

`scripts/e2e/l5-transition.ps1` passou 24 de 24 verificações na build release, com o atalho global real enviado pela fila de entrada do Windows:

- A primeira abertura, sem área, foi para Edição: janela top-level, sempre no topo, sem click-through, com o foreground, o seletor de área e a toolbar. Uma tecla `e` enviada pelo Windows trocou a ferramenta para Borracha, então a WebView recebeu o teclado de verdade.
- **Fixar no desktop** salvou a área e o traço e devolveu a janela a Progman, click-through e fora do topo, com a toolbar oculta, cerca de 30 ms depois do clique.
- Ctrl + Alt + T levou o mesmo documento para Edição e, apertado de novo, salvou o traço novo antes de fixar. Cada transição terminou menos de 10 ms depois de o atalho chegar.
- Esc fora do editor salvou e fixou.
- Com o localStorage cheio, Fixar no desktop manteve a Edição e o aviso Tentar novamente; o documento salvo continuou na revisão anterior. Com espaço de volta, o pin funcionou.
- Uma segunda abertura encerrou com código 0 e trouxe a área da primeira instância para Edição.
- O log registrou o atalho, o pedido de pin vindo do atalho, a segunda instância e a sequência Wall → Edit → Wall cinco vezes.

Na mesma build, as suítes anteriores continuaram passando: L2 com 41 de 41, L3 com 27 de 27 e L4 com 15 de 15. `cargo check` terminou sem warnings.

O tray usa as mesmas funções do atalho e de enter_edit, mas não foi acionado pelo E2E: clicar no ícone da área de notificação exigiria mexer na barra de tarefas do usuário.

## Evidência registrada em 2026-10-14: L6

`scripts/e2e/l6-lifecycle.ps1` passou 24 de 24 verificações na build release, num monitor de 1920 × 1080 a 100%, com o Explorer real reiniciado duas vezes:

- Alt + F4 enviado pelo Windows, em Edição, salvou o traço e fixou a área em 3 ms, sem encerrar o processo. A janela voltou ao Progman, click-through e fora do topo.
- Com o localStorage cheio, o save falhou, o aviso Tentar novamente apareceu e o log registrou `frontend: document save failed`. Com espaço de volta, o pin funcionou.
- Uma janela viva tirada do Progman voltou a ele, acima dos ícones, em 2,2 s, e o atalho e Fixar no desktop continuaram funcionando.
- Queda do Explorer (`Stop-Process -Force`): o Windows reiniciou o shell em 0,25 s. O Canvie reiniciou e a área voltou ao Progman 4 s depois, com o mesmo documento e um Wall embutido.
- Saída normal do Explorer (o comando Exit Explorer da taskbar): o script iniciou o shell, que ficou pronto em 1,4 s. O log registrou `main window destroyed outside a quit`, e a área voltou ao Progman 3,9 s depois, pelo mesmo reinício.
- Por 10 s depois disso, o watchdog não reencaixou nem reiniciou nada.
- Um WM_CLOSE em Fixo encerrou o processo com código 0.
- O log registrou uma abertura por processo (4), nenhuma linha de erro, o pin pedido pelo fechamento, a janela fora do Progman, o reencaixe e o fechamento em Fixo.

A primeira execução encontrou um defeito: depois da queda do Explorer, o watchdog tentava reencaixar uma janela cujo HWND estava morto, falhava com `O identificador da janela é inválido` e esperava cada vez mais entre as tentativas. Cada evento para a WebView morta gerava um ERROR no log. O watchdog passou a conferir o HWND com IsWindow e a reiniciar o Canvie. A segunda execução travou na saída normal, porque o explorer.exe iniciado pelo script herdou o pipe de saída do driver; `restart-explorer.ps1` passou a usar CreateProcess sem herança de handles.

O E2E não confere o ícone do tray depois de um reinício. O processo novo cria o tray na abertura, e o log não registrou `tray unavailable`.

A regressão das suítes anteriores encontrou uma mudança de comportamento: na primeira abertura, sem área, Alt + F4 deixou de fechar o app e não fazia nada, porque não havia o que fixar. Por decisão do produto, o fechamento em Edição passou a emitir `canvie-close-requested`. O frontend fixa quando existe área e chama quit_app quando não existe. Na build release final:

- `l6-lifecycle.ps1 -SkipExplorer` passou 18 de 18: Alt + F4 sem área encerrou o app com código 0, Alt + F4 com área fixou em 5 ms sem encerrar, e o log registrou `close requested in Edit` e `close requested without an area: quit`. O watchdog não mudou desde a execução com os dois reinícios do Explorer;
- L2 passou 41 de 41, L3 27 de 27, L4 17 de 17 e L5 24 de 24.

A revisão do PR pediu duas correções: gravar o save pendente antes de encerrar sem área, e fazer `stop('close')` aceitar um app que encerra no primeiro WM_CLOSE. Na build release com as duas:

- L2 passou 41 de 41, L3 27 de 27 e L5 24 de 24;
- `l6-lifecycle.ps1 -SkipExplorer` passou todas as checagens de comportamento, incluindo a nova `stop(close) ends the app in Edit without an area`. As cinco checagens de log falharam porque o log rotacionou no meio da execução (veja Falhas conhecidas). Repetida com o log em 8 KB, a suíte passou 19 de 19, com todas as checagens de log.

O flush antes de `quit_app` não tem E2E: o envio de uma tecla real abre um PowerShell e leva mais que os 350 ms do debounce.

Na L4, a checagem da área pintada sobre o desktop rodou pela primeira vez, porque havia uma região de 240 × 160 px sem janelas, e leu o bege exato, rgb(244, 236, 220). Antes, `screen-pixel.ps1` devolvia `[r, g, b]` em vez de `[[r, g, b]]` para um único ponto, porque o PowerShell achata a saída de um pipeline com um array só, e a checagem falhava mesmo com a cor certa.

As suítes que abrem a Edição em tela cheia (L2, L3 e L5) mostram o canvas sobre as janelas abertas e recebem o mouse e o teclado de quem estiver usando a máquina. Uma execução enquanto o usuário trabalhava perdeu o foco do editor de nota e um pin; com a máquina ociosa, as mesmas suítes passaram. Rode-as sem usar o computador.

## Evidência registrada em 2026-10-14: L7

Instalador NSIS `Canvie_0.0.1_x64-setup.exe`, de 1,9 MB, num monitor de 1920 × 1080 a 100%.

`l7-install.ps1` passou 10 de 10:

- a instalação silenciosa terminou com código 0 em 2,9 s, sem pedir elevação, registrada só em HKCU e com o executável em `%LOCALAPPDATA%\Canvie`;
- o atalho do menu Iniciar aponta para o executável instalado, abre o Canvie e o log registra a abertura;
- a desinstalação silenciosa removeu o executável, o registro e o atalho, e manteve `%APPDATA%\com.canvie.app`;
- uma segunda instalação funcionou depois da desinstalação, e o Canvie ficou instalado.

Na build instalada, `l7-installed.ps1` passou 11 de 11:

- o Tab real começa no pegador e percorre os 16 controles habilitados da toolbar na ordem do DOM, cada um com nome acessível e contorno de foco de 2 px;
- E e B trocam entre Borracha e Pincel, e Ctrl + Z e Ctrl + Y desfazem e refazem um traço pelo teclado real;
- Fixar no desktop chegou a Wall em 30 ms, e Ctrl + Alt + T chegou a Edit em 5 ms.

A mesma build passou as suítes anteriores com `-Exe` apontando para o executável instalado: L2 41 de 41, L3 27 de 27, L4 15 de 15, L5 24 de 24 e L6 27 de 27, com os dois reinícios do Explorer. Na build instalada, a área voltou ao Progman 9,1 s depois da queda do Explorer e 7,9 s depois da saída normal, pelo reinício do Canvie. A checagem da L4 que confere a área pintada sobre o desktop não rodou, porque a tela estava toda coberta por janelas.

| Métrica da build instalada | Fixo | Edição |
| --- | --- | --- |
| Working set depois de 60 s, canvie.exe e 6 processos do WebView2 | 350,6 MB | 349,9 MB |
| CPU em repouso | 0,28 s por minuto | 0,08 s por minuto |
| Tempo da transição | 30 ms (Fixar no desktop até Wall) | 5 ms (Ctrl + Alt + T até Edit) |

## Evidência registrada em 2026-10-14: L8

`scripts/e2e/l8-document-v2.ps1` passou 23 de 23 na build release, com o perfil compartilhado entre a build instalada da L7 e a build da L8:

- pela interface, a build da L7 gravou um documento v1 na revisão 7: área de 800 × 520, três traços em preto, azul e vermelho, uma nota média com tabela, um post-it grande e fundo transparente;
- a build da L8 abriu o mesmo perfil sem aviso de recuperação e não gravou nada antes da primeira edição. Ela mostrou a mesma área, a tabela, o post-it, a nota em 18 px e o post-it em 24 px, com os traços desenhados;
- o primeiro traço gravou `canvie.document` na versão 2, revisão 8. Os três traços antigos ficaram com id, cor, largura e pontos iguais, com `brush: pen`. As notas ficaram com id, texto e posição iguais, `md` e `lg`, `sans` e `left`. Área, fundo e câmera não mudaram;
- `canvie.document.v1` ficou idêntica, caractere por caractere, antes e depois do save v2;
- matar o processo e abrir de novo trouxe o mesmo v2;
- um v2 com todos os valores novos renderizou: 12 px em Georgia, 32 px em Cascadia Mono ao centro, 48 px à direita, post-it em serifa, texto claro sobre o fundo preto, marca-texto com 7 272 pixels a cerca de 35% de opacidade, e fundos preto, branco e amarelo pintados;
- a versão 3 e um v1 corrompido sozinho abriram o fluxo de recuperação; o v1 corrompido ficou intocado na própria chave.
- sobre o fundo preto, o editor de uma nota manteve o texto escuro no campo claro, com a fonte e o tamanho da nota. A primeira versão da regra que clareia o texto no fundo preto pegava também o editor; a revisão encontrou o defeito, e a checagem entrou na suíte.

Na mesma build, a regressão passou: L2 41 de 41, L3 27 de 27, L4 15 de 15, L5 24 de 24 e L6 19 de 19 sem reiniciar o Explorer. Na L4, a checagem da pintura sobre o desktop não rodou porque a tela estava coberta.

## Evidência registrada em 2026-10-14: L9

`scripts/e2e/l9-selection-hand.ps1` passou 24 de 24 na build release:

- Edição começa em Seleção, sem ferramenta pressionada, e a toolbar mostra Mão no lugar de Mover;
- um duplo clique no canvas vazio abriu o editor; a nota ficou onde o clique caiu, com `sans` e `left`, e o canvas voltou à Seleção com a nota selecionada e a barra de alinhamento;
- arrastar a nota selecionada a moveu exatamente 40 × 30 px; Centralizar gravou e renderizou `align: center`; Delete apagou a nota, e Ctrl + Z a trouxe de volta, centralizada;
- com a Mão, arrastar sobre uma nota moveu só a câmera, em −60 × −40, e um duplo clique também abriu uma nota, que devolveu o canvas à Seleção;
- repetir a letra ou clicar na ferramenta ativa volta à Seleção; escolher uma tinta escolhe o Pincel; um duplo clique com o Pincel não abre editor; um post-it novo volta à Seleção, selecionado;
- o primeiro Esc limpou a seleção e manteve a Edição; o segundo salvou e fixou.

Na mesma build, a regressão passou: L3 27 de 27, L4 15 de 15, L5 24 de 24, L6 19 de 19 sem reiniciar o Explorer e L8 23 de 23. A L2 passou as 40 checagens de comportamento. A checagem de uma abertura por processo no log falhou porque o log rotacionou às 18:12:45, no meio da suíte.

## Evidência registrada em 2026-10-14: L10 e L11

`scripts/e2e/l10-l11-menu-toolbar.ps1` passou 52 de 52 na build release final, num monitor de 1920 × 1080 a 100%, com a área de trabalho terminando em 1032:

- a toolbar abriu centralizada (centro em 960) com a base em 1012, 20 px acima da taskbar, na ordem aba, Texto, Post-it, Pincel, Mão e Fixar;
- a aba ficou com opacidade 0 em repouso e 1 com o ponteiro na barra e com o foco do Tab; o Tab percorreu aba, ferramentas e Fixar na ordem;
- o popover do Pincel abriu acima da barra; a Borracha manteve o Pincel pressionado; uma tinta voltou à Caneta e desenhou em vermelho; as ferramentas não moveram a barra; o primeiro Esc fechou o popover e manteve a ferramenta e a Edição; Texto abriu os tamanhos com Médio pressionado;
- o editor de uma nota nova não teve borda, fundo, contorno nem placeholder; os tamanhos apareceram durante a escrita em Seleção; Texto grande manteve o editor aberto; a nota renderizada ficou em 280 × 360 com a mesma largura do editor, 224,6 px;
- o botão direito abriu o menu no ponteiro, em 860 × 200, sem desenhar com o Pincel ativo; o foco foi para o primeiro item, as setas andaram, Tab e Shift + Tab ficaram no menu e chegaram ao campo do zoom, Esc fechou sem fixar e, fora da área, nada abriu; Shift + F10 abriu no centro da área, em 580 × 390;
- os cinco temas foram gravados e pintados, e o menu marcou Preto;
- Zoom 200%, 50% e 150% digitado aplicaram; 1000 parou em 400%; depois de a Mão empurrar a nota para fora da vista, Ajustar à tela a trouxe de volta com zoom 2,28, e Ctrl + Z desfez;
- Limpar abriu com o foco em Cancelar; Enter em Cancelar e Esc mantiveram tudo; Tab foi para Limpar, e Enter removeu traços e notas e manteve área, tema e câmera; Ctrl + Z trouxe tudo de volta;
- arrastar a aba moveu a barra 500 × 420 px e gravou `{ left: 342, top: 534 }` em `canvie.toolbar`, fora do documento; depois de matar o processo, a toolbar abriu no mesmo lugar; Reposicionar toolbar voltou ao padrão e apagou a preferência;
- uma posição fora da tela e um JSON inválido abriram no padrão, foram apagados e deixaram um WARN cada no log.

Na build anterior, só com a aba antiga, a regressão passou: L2 41 de 41, L3 27 de 27, L5 25 de 25, L8 23 de 23 e L9 25 de 25. A primeira L2, logo depois da suíte da L10 e da L11, falhou só na checagem de long tasks (714 e 448 ms); a repetição não teve nenhuma long task. A L5 mudou para o Esc em dois passos com o Pincel. A L8 passou a esperar texto claro no editor sobre o tema preto, porque o editor não tem mais campo próprio. A L4, a L6 e a L7 não rodaram: o estado Fixo, o ciclo de vida e o instalador não mudaram, e o fechamento da 0.0.2 roda a matriz da L7 de novo. O item Reposicionar toolbar do tray não foi acionado pelo E2E, pelo mesmo motivo do resto do tray.

O `lucide-react` 1.57.0, com nove ícones importados um a um, o menu e a toolbar nova levaram o JavaScript de 345,55 kB para 360,01 kB minificado (de 118,87 kB para 124,09 kB com gzip).

## Evidência registrada em 2026-10-14: L12

`scripts/e2e/l12-preset-values.ps1` passou 18 de 18 na build release:

- o popover do Pincel ofereceu Caneta, Marca-texto, Borracha e as seis tintas, na ordem;
- seis traços de caneta foram gravados com a cor de cada tinta e 3 px. O traço do marca-texto foi gravado em amarelo, com 18 px e `brush: highlighter`;
- no canvas, a caneta azul ficou opaca (alfa 255), e o marca-texto ficou com alfa 89, cerca de 35%;
- seis notas, uma em cada tamanho, alternando Serifa, Sem serifa e Mono, renderizaram em 12, 14, 18, 24, 32 e 48 px. Cada família manteve a reserva da mesma família, e as três fontes estavam instaladas na máquina;
- abrir uma nota mostrou a fonte dela no popover; trocar para Mono gravou `mono`, e Ctrl + Z voltou para `serif`;
- a melhor tinta teve contraste de 13,4:1 no bege, 15,8:1 no branco, 16,3:1 no preto e 14,2:1 no amarelo;
- depois de matar o processo, o documento voltou idêntico, com as notas nos mesmos tamanhos e o marca-texto ainda translúcido.

Na mesma build, a L3 passou 27 de 27 e a L10 e a L11 passaram 52 de 52. Duas rodadas anteriores da L10 e da L11 falharam em checagens de hover, de foco e do arraste da aba, porque o mouse real se mexeu durante a suíte. Com o mouse parado, tudo passou.

O JavaScript foi de 360,01 kB para 361,88 kB minificado (de 124,09 kB para 124,66 kB com gzip).

### Pendências manuais da L7

Estes itens mudam configurações do Windows ou reiniciam o computador. Por isso ficam com quem usa a máquina, e a L7 só fecha depois deles:

1. **Reinício do Windows:** com uma área fixa e um traço salvo, reinicie o Windows, abra o Canvie pelo menu Iniciar e confira a mesma área e o mesmo traço.
2. **Escala de tela:** em Configurações > Sistema > Tela, troque a escala para 125%, 150% e 200%. Em cada uma, rode `l4-fixed-area.ps1` e `l5-transition.ps1` com `-Exe` e confira que a área e a toolbar aparecem inteiras.
3. **Narrador:** ligue com Ctrl + Win + Enter, entre em Edição e percorra a toolbar com Tab. Cada controle precisa ser lido em português.
4. **Alto contraste:** ligue com Alt esquerdo + Shift esquerdo + Print Screen. Em Edição, a toolbar e o contorno de foco precisam continuar visíveis.

## Falhas conhecidas

- Win + T pertence ao Explorer. Use Ctrl + Alt + T.
- Atrás de SHELLDLL_DefView não há input. Parede precisa de click-through.
- Na primeira abertura, o evento de placement pode chegar antes de o listener do frontend existir. O App só lê o placement atual depois de a assinatura estar confirmada.
- tao pode reescrever WS_CHILD. Reaplique parent e estilos após always_on_top, ignore_cursor_events e show.
- O click-through do tao liga WS_EX_LAYERED sem SetLayeredWindowAttributes. Sem os atributos, a janela não aparece no desktop, embora o hit-test funcione.
- Quando o Explorer reinicia, a janela filha do Progman é destruída. Numa queda, o Windows não manda WM_DESTROY, e o Tauri fica com um HWND morto que IsWindow detecta. O watchdog da L6 reinicia o Canvie nos dois casos; veja [BACKEND.md](BACKEND.md#reinício-do-explorer).
- Uma janela de outro processo criada com `UseShellExecute = false` herda os handles de quem a criou. Um explorer.exe iniciado assim segurou o pipe de saída do E2E, e o `execFileSync` do Node nunca terminou. `restart-explorer.ps1` usa CreateProcess sem herança de handles.
- Em Edição, a janela do Canvie fica à frente de tudo e recebe o mouse real. Mexer o mouse durante uma suíte muda o hover e o alvo do ponteiro, e quebra checagens de hover, de foco e de arraste. Rode as suítes com o mouse e o teclado parados.
- A checagem de long tasks da L2 falhou uma vez logo depois de outra suíte, com tarefas de 714 ms, e passou sem nenhuma ao repetir. Repita a suíte antes de investigar.
- O log do release roda em 40 KB e descarta o arquivo anterior (padrão do tauri-plugin-log, RotationStrategy::KeepOne). Uma suíte que cruza a rotação perde as linhas de antes e falha nas checagens de log, embora o app tenha registrado tudo. Rode de novo com o log menor.
- A simulação com um formulário WinForms como pai, morto à força, deixou a janela filha viva e órfã. Com o Explorer real, a janela morre. Teste o shell de verdade.
- No PowerShell, `$null` passado a um parâmetro string vira texto vazio. Use `[NullString]::Value` em chamadas como FindWindow.
- Uma capacidade negada precisa gerar warn e manter o app iniciado.
- Um saveNow falho não pode reparentar a janela.
- O localStorage do WebView2 aceita cerca de 5,24 milhões de caracteres por origem, somando o documento e a cópia de um payload inválido. Acima disso, o save falha e o aviso Tentar novamente aparece.
- O WebView2 grava o localStorage em disco alguns segundos depois do save. Matar só o `canvie.exe` preserva o save, porque o WebView2 grava ao encerrar. Matar também os processos do WebView2 (`taskkill /T /F`, falta de energia) perdeu o save feito 0,6 s e 2 s antes; 6 s e 12 s depois, o save estava preservado.

## Métricas locais

Registre em cada build instalada:

- working set depois de 60 segundos na Parede;
- working set depois de 60 segundos em Edição;
- CPU média em cada estado;
- tempo entre o atalho e o evento Edit;
- tempo entre Fixar no desktop e o evento Wall.

Não envie essas métricas para fora da máquina.
