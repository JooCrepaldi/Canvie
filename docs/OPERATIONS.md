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

O target do Rust deve ficar fora do OneDrive. Use CARGO_BUILD_JOBS=1 nesta máquina.

Um rustc que termina com `0xc0000409, STATUS_STACK_BUFFER_OVERRUN` aqui é falta de memória do LLVM: o log mostra `rustc-LLVM ERROR: out of memory` logo antes. A máquina tem 6 GB. Feche outros servidores de desenvolvimento e páginas pesadas e rode o build de novo; o Cargo reaproveita os crates já compilados.

Os E2E das camadas rodam depois de `npm run tauri build`, um de cada vez, porque usam a mesma porta de DevTools e a instância única:

    Set-Location frontend
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l2-persistence.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l3-area-content.ps1
    powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l4-fixed-area.ps1

Cada script abre o executável release com o perfil do WebView2 redirecionado para uma pasta temporária e confirma o redirecionamento antes de qualquer escrita. O canvas real do usuário não é lido nem alterado. Ele dirige a página pelo protocolo DevTools com input real de mouse e teclado. O E2E da L4 lê o estado Win32 da janela por `scripts/e2e/lib/win32-probe.ps1` e nunca move as janelas do usuário. O E2E da L4 lê o estado Win32 da janela por `scripts/e2e/lib/win32-probe.ps1` e nunca move as janelas do usuário. Screenshots e `report.json` ficam na pasta de evidência impressa no fim.

## Evidência por camada

| Camada | Evidência |
| --- | --- |
| L0 | build frontend, oxlint, cargo check e janela vazia |
| L1 | gravação manual de traço e nota no browser e na janela Tauri |
| L2 | `scripts/e2e/l2-persistence.ps1`: fechar processo e recuperar o mesmo documento; JSON inválido não derruba o app; falha de gravação mantém a sessão |
| L3 | `scripts/e2e/l3-area-content.ps1`: área por arraste, três tintas, Markdown, post-it, mover, apagar, fundo e reabertura |
| L4 | parent Progman, click-through, transparência fora da área, acesso normal ao desktop e memória em repouso |
| L5 | log Wall → Edit → Wall, atalho real, toolbar, save antes de pin, tray e retorno visual |
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

## E2E de transição

O script de L5 precisa:

1. iniciar uma build instalada;
2. localizar a janela principal pelo PID;
3. verificar que o parent inicial é Progman;
4. enviar Ctrl + Alt + T;
5. verificar top-level, foco e always-on-top;
6. desenhar ou criar uma nota;
7. acionar Fixar no desktop;
8. verificar reparent em Progman, click-through e toolbar oculta;
9. abrir a aplicação novamente e verificar o documento;
10. extrair do log as transições Wall → Edit e Edit → Wall.

Não use mocks para validar o parent, o foco, o atalho ou o processo.

## Falhas conhecidas

- Win + T pertence ao Explorer. Use Ctrl + Alt + T.
- Atrás de SHELLDLL_DefView não há input. Parede precisa de click-through.
- tao pode reescrever WS_CHILD. Reaplique parent e estilos após always_on_top, ignore_cursor_events e show.
- O click-through do tao liga WS_EX_LAYERED sem SetLayeredWindowAttributes. Sem os atributos, a janela não aparece no desktop, embora o hit-test funcione.
- Uma janela filha de Progman pode ser destruída quando o Explorer reinicia. A recriação está prevista na L6.
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
