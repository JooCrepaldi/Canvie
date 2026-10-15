# Roadmap do primeiro ciclo

Cada camada fecha um comportamento observável antes da próxima começar. A evidência de cada camada fica em [OPERATIONS.md](OPERATIONS.md).

O núcleo do ciclo é a transição da área do canvas:

    Fixo → Edição → Fixo

Fixo é o nome do produto para o placement Wall. A direção atual está em [product.md](../product.md) e na decisão [0006](../decisions/0006-delimited-desktop-area.md). Todas as camadas usam o menor número de processos e dependências que permita provar essa transição em uma máquina Windows real.

## L0 — Contrato e scaffold

**Objetivo:** criar a aplicação Tauri vazia e confirmar a stack.

**Inclui:**

- Tauri 2, Rust, WebView2, React 19, Vite e TypeScript estrito;
- uma janela transparente;
- scripts de build e lint;
- estrutura de frontend, src-tauri, capabilities e documentos;
- um log de inicialização.

**Falha tratada:** se WebView2, Rust ou o build não estiver disponível, o erro aparece no comando de verificação e não é escondido por um fallback.

**Done:** npm run build, oxlint e cargo check passam; a build abre uma janela vazia; nenhum segundo processo é criado pelo app.

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

## L3 — Área e conteúdo

**Objetivo:** entregar a área delimitada e o conteúdo do MVP em uma janela comum, antes de prendê-la ao desktop.

**Inclui:**

- área retangular definida ao arrastar com o botão esquerdo, salva no documento, e a ação Área para redefini-la;
- fundo bege ou transparente, salvo no documento;
- um pincel com preto, azul e vermelho;
- notas em Markdown com uma fonte e três tamanhos, renderizadas sem HTML bruto;
- post-its como notas sobre um cartão amarelo;
- editar com duplo clique, mover com a ferramenta Mover e apagar notas com a borracha;
- toolbar com essas ferramentas, desfazer, refazer e fundo.

**Falha tratada:** um documento antigo ou inválido abre o fluxo de recuperação da L2, e uma área fora da tela é limitada ao viewport.

**Done:** em uma build release, definir a área, desenhar nas três cores, escrever uma nota com tabela, colar um post-it, editar, mover e apagar notas, trocar o fundo, matar o processo e reabrir com a mesma área e o mesmo conteúdo.

## L4 — Área fixa no desktop

**Objetivo:** prender a área ao desktop com baixo custo de execução.

**Inclui:**

- janela sem bordas e transparente do tamanho do monitor principal;
- parent Progman;
- camada acima dos ícones e abaixo da taskbar e das janelas comuns;
- click-through em toda a janela;
- re-embed depois de qualquer chamada tao que reescreva estilos.

**Falha tratada:** se o Explorer não oferecer o parent, o app mantém uma janela transparente funcional e registra o motivo.

**Done:** uma build release mostra a área no desktop; cliques nos ícones e em outros apps continuam funcionando; fora da área não há fundo opaco; a memória em repouso fica registrada.

## L5 — Transição Fixo ↔ Edição

**Objetivo:** entregar o comportamento principal do Canvie.

**Inclui:**

- PlacementState único no backend;
- Ctrl + Alt + T global;
- enter_edit e pin_to_wall;
- desanexar para top-level, sempre no topo, e focar;
- toolbar, escurecimento e seleção de área apenas em Edição;
- botão **Fixar no desktop**;
- fluxo Salvando → saveNow → re-embed;
- evento canvie-placement e canvie-pin-requested;
- retorno por Esc, pelo atalho e pelo tray;
- tray com Editar, Fixar no desktop e Sair;
- single-instance que traz a área da instância aberta para Edição;
- primeira abertura em Edição quando ainda não existe área.

**Falha tratada:** se saveNow falhar, o backend não recebe pin_to_wall. A janela permanece em Edição e mostra Tentar novamente. Se o atalho falhar, o tray continua funcionando.

**Done:** iniciar com a área Fixa, chamar Edição enquanto outro app está aberto, desenhar e escrever, usar o atalho ou Fixar no desktop e ver o mesmo documento voltar ao desktop. O log contém a sequência Wall → Edit → Wall.

## L6 — Ciclo de vida em segundo plano

**Objetivo:** deixar o Canvie disponível sem ocupar o fluxo do usuário.

**Inclui:**

- Alt + F4 em Edição fixa a área em vez de encerrar;
- devolver a área ao novo Progman quando o Explorer reiniciar, depois de uma queda ou de uma saída normal;
- logs de startup, atalho, transição, falha de save e re-embed, incluindo as falhas de persistência do frontend.

**Falha tratada:** uma ação do tray que falhar mantém o processo ativo e mostra um aviso no log.

**Done:** Alt + F4 em Edição fixa a área sem encerrar; reiniciar o Explorer devolve a área ao desktop; o log registra uma falha de save do frontend.

## L7 — Pacote e prova na máquina

**Objetivo:** verificar o ciclo completo em uma instalação real.

**Inclui:**

- bundle release para Windows;
- teste de instalação e desinstalação;
- teste de reinício do processo e do Windows;
- escala de 100%, 125%, 150% e 200%;
- teclado, foco, Narrador e alto contraste;
- medição de RAM e CPU nos estados Fixo e Edição.

**Falha tratada:** qualquer comportamento que não possa ser observado em log, tecla, janela ou documento fica pendente. Não marcar a camada como concluída por um mock.

**Done:** a matriz E2E de docs/OPERATIONS.md passa em uma build instalada e o número real de RAM e CPU fica registrado.

## Ordem

    L0 → L1 → L2 → L3 → L4 → L5 → L6 → L7

L5 é a primeira camada que entrega a proposta completa. L4 precisa estar comprovada antes dela, porque Edição depende de reanexar a janela ao desktop sem perder o canvas. As [próximas versões](../product.md#próximas-versões) entram depois da L7. A 0.2 continua em [ROADMAP-0.2.md](ROADMAP-0.2.md), a partir da L8.
