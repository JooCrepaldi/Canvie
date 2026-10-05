# Roadmap do primeiro ciclo

O projeto começa sem código. Cada camada fecha um comportamento observável antes da próxima começar.

O núcleo do ciclo é a transição:

    Parede → Edição → Parede

Todas as camadas usam o menor número de processos e dependências que permita provar essa transição em uma máquina Windows real.

## L0 — Contrato e scaffold

**Objetivo:** criar a aplicação Tauri vazia e confirmar a stack.

**Inclui:**

- Tauri 2, Rust, WebView2, React 19, Vite e TypeScript estrito;
- uma janela transparente;
- scripts de build e lint;
- estrutura de frontend, src-tauri, capabilities e documentos;
- um log de inicialização.

**Falha tratada:** se WebView2, Rust ou o build não estiver disponível, o erro aparece no comando de verificação e não é escondido por um fallback.

**Done:** npm run build, oxlint e cargo check passam; npm run tauri dev abre uma janela vazia; nenhum segundo processo é criado pelo app.

## L1 — Canvas local em janela comum

**Objetivo:** provar o desenho sem depender do Windows desktop.

**Inclui:**

- um Canvas 2D com DPR;
- pincel, borracha, nota de texto, pan e zoom;
- undo e redo como pilhas explícitas;
- toolbar provisória sempre visível;
- ponte de navegador sem APIs Tauri.

**Falha tratada:** se uma API Tauri estiver ausente, o canvas continua editável no navegador.

**Done:** criar 50 traços, inserir uma nota, apagar, desfazer, refazer, mover a câmera e manter interação fluida sem renderizar React a cada movimento do ponteiro.

## L2 — Documento persistente

**Objetivo:** fechar e reabrir sem perder o canvas.

**Inclui:**

- CanvasDoc v1 com revisão;
- validação de cada campo na borda;
- localStorage no perfil do WebView2;
- save debounced de 350 ms;
- saveNow para uma transição;
- carregamento de documento vazio quando o JSON estiver inválido;
- backup local do payload inválido.

**Falha tratada:** um erro de gravação mantém o último documento válido em memória e deixa a sessão aberta.

**Done:** matar o processo, abrir de novo e recuperar o documento; editar durante um save sem travar; provar que um JSON inválido não derruba o app.

## L3 — Parede do desktop

**Objetivo:** integrar o canvas ao desktop com baixo custo de execução.

**Inclui:**

- janela fullscreen transparente;
- parent Progman;
- camada elevada acima dos ícones e abaixo da taskbar e das janelas comuns;
- click-through em toda a área;
- restauração de tamanho, posição e monitor principal;
- re-embed depois de qualquer chamada tao que reescreva estilos.

**Falha tratada:** se o Explorer não oferecer o parent, o app mantém uma janela transparente funcional, registra o motivo e oferece o tray.

**Done:** uma build instalada mostra o canvas na Parede; cliques nos ícones e em outro app continuam funcionando; a tela não ganha fundo opaco; a memória em repouso fica registrada.

## L4 — Sistema de transição Parede ↔ Edição

**Objetivo:** entregar o comportamento principal do Canvie.

**Inclui:**

- PlacementState único no backend;
- Ctrl + Alt + T global;
- enter_edit e pin_to_wall;
- desanexar para top-level e focar;
- toolbar apenas em Edição;
- botão **Fixar no desktop**;
- fluxo Salvando → saveNow → re-embed;
- evento canvie-placement;
- retorno pelo Esc e pelo tray.

**Falha tratada:** se saveNow falhar, o backend não recebe pin_to_wall. A janela permanece em Edição e mostra Tentar novamente. Se o atalho falhar, o tray continua funcionando.

**Done:** iniciar na Parede, chamar Edição enquanto outro app está aberto, desenhar e escrever, clicar em Fixar no desktop e ver o mesmo documento voltar à Parede. O log contém a sequência Wall → Edit → Wall.

## L5 — Ciclo de vida em segundo plano

**Objetivo:** deixar o Canvie disponível sem ocupar o fluxo do usuário.

**Inclui:**

- tray com Editar, Fixar no desktop, Mostrar e Sair;
- fechar a janela esconde para o tray;
- single-instance com foco na instância existente;
- autostart apontando para o executável instalado;
- logs de startup, atalho, transição, falha de save e re-embed.

**Falha tratada:** uma ação do tray que falhar mantém o processo ativo e mostra um aviso no log.

**Done:** reiniciar o Windows, encontrar o Canvie no tray, chamar Edição, fechar sem encerrar e confirmar que uma segunda abertura foca a primeira.

## L6 — Pacote e prova na máquina

**Objetivo:** verificar o ciclo completo em uma instalação real.

**Inclui:**

- bundle release para Windows;
- teste de instalação e desinstalação;
- teste de reinício do processo e do Windows;
- escala de 100%, 125%, 150% e 200%;
- teclado, foco, Narrador e alto contraste;
- medição de RAM e CPU em Parede e Edição.

**Falha tratada:** qualquer comportamento que não possa ser observado em log, tecla, janela ou documento fica pendente. Não marcar a camada como concluída por um mock.

**Done:** a matriz E2E de docs/OPERATIONS.md passa em uma build instalada e o número real de RAM e CPU fica registrado.

## Ordem

    L0 → L1 → L2 → L3 → L4 → L5 → L6

L4 é a primeira camada que entrega a proposta completa. L3 precisa estar comprovada antes dela, porque Edição depende de reanexar a janela à Parede sem perder o canvas.
