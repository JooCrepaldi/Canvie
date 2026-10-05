# Operação

Esta página define a verificação que acompanha cada camada. O scaffold L0 e o canvas em memória L1 já estão no repositório.

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

## Evidência por camada

| Camada | Evidência |
| --- | --- |
| L0 | build frontend, oxlint, cargo check e janela vazia |
| L1 | gravação manual de traço e nota no browser e na janela Tauri |
| L2 | fechar processo e recuperar o mesmo documento; JSON inválido não derruba o app |
| L3 | parent Progman, click-through, transparência e acesso normal ao desktop |
| L4 | log Wall → Edit → Wall, atalho real, toolbar, save antes de pin e retorno visual |
| L5 | tray, close para tray, autostart e segunda instância |
| L6 | instalador, reinício do Windows, escala DPI, teclado, RAM e CPU |

## Evidência registrada em 2026-10-05

- L0: `npm run build`, `npx oxlint` e `cargo check --locked` passaram. A build release com símbolos desligados passou e registrou `Canvie startup`. Uma segunda abertura manteve um único processo `canvie`.
- L0: `npm run tauri dev` ainda não abre uma janela nesta máquina porque o `rustc` cai ao compilar o crate `windows` no perfil dev com `STATUS_STACK_BUFFER_OVERRUN`. A build release passa; a janela nativa não pôde ser inspecionada visualmente porque o processo iniciado pelo terminal não expõe uma janela na sessão interativa do agente.
- L1: no browser fallback, a prova manual criou um traço, desfez, refez, criou a nota `Ideia rápida`, apagou o traço, moveu a toolbar pelo pegador e moveu/ampliou a câmera. A prova de 50 traços fica para o fechamento da camada.

## E2E de transição

O script de L4 precisa:

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
- tao pode reescrever WS_CHILD. Reaplique parent e estilos após always_on_top e ignore_cursor_events.
- Uma capacidade negada precisa gerar warn e manter o app iniciado.
- Um saveNow falho não pode reparentar a janela.

## Métricas locais

Registre em cada build instalada:

- working set depois de 60 segundos na Parede;
- working set depois de 60 segundos em Edição;
- CPU média em cada estado;
- tempo entre o atalho e o evento Edit;
- tempo entre Fixar no desktop e o evento Wall.

Não envie essas métricas para fora da máquina.
