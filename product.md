# Produto

O Canvie é uma área de anotação fixa no desktop do Windows. O usuário escolhe um retângulo do desktop, e esse retângulo vira um canvas onde ele desenha, escreve em Markdown e cola post-its. A ideia fica visível no desktop sem abrir um whiteboard.

## A proposta

O Canvie não ocupa o wallpaper inteiro. O canvas é uma parte delimitada do desktop, com posição e tamanho escolhidos pelo usuário: ele clica com o botão esquerdo e arrasta para definir o retângulo, maior ou menor, mais largo ou mais alto.

A área fica fixa no desktop enquanto o usuário trabalha em outros programas. Ela não recebe cliques nesse estado e não cobre as janelas abertas.

Quando o usuário precisa anotar algo, por exemplo enquanto assiste a um vídeo no navegador, ele usa um atalho. A área vem para a frente de todas as janelas, recebe foco e mostra a toolbar. O usuário desenha ou escreve e usa o mesmo atalho, ou o botão **Fixar no desktop**. O Canvie salva o documento e devolve a área ao desktop com todos os elementos.

Essa troca é o produto. A anotação rápida não exige procurar o app, fechar janelas nem reorganizar o desktop.

## Usuário

O primeiro usuário é o próprio criador do Canvie: alguém que passa o dia no Windows e precisa registrar uma ideia enquanto trabalha em outro app.

## Princípios

- **Desktop primeiro.** O estado normal é a área quieta e fixa no desktop.
- **Edição sob demanda.** A toolbar aparece apenas quando o usuário traz a área para a frente.
- **Um canvas.** Uma área e um documento reduzem decisões, memória e tempo de recuperação. A 0.0.3 revê este princípio para vários canvases.
- **Local.** O conteúdo fica na máquina. Não há conta, servidor, sincronização ou telemetria.
- **MVP cru.** O primeiro ciclo entrega uma opção de cada coisa e cresce depois que a troca entre desktop e edição funcionar.
- **Valores prontos.** Depois da 0.0.1, tamanhos, fontes, cores e temas crescem como listas curtas e fixas. Escolher é um clique, não um ajuste. A decisão está em [0008](decisions/0008-preset-values.md).
- **Retorno claro.** O botão **Fixar no desktop** sempre deixa visível o que acontecerá com a edição.

## Escopo do primeiro ciclo

O primeiro ciclo entrega:

- uma área retangular definida pelo usuário ao arrastar no desktop, com posição e tamanho salvos, e a ação de redefinir a área;
- fundo da área em bege ou transparente;
- um pincel com três cores: preto, azul e vermelho;
- notas de texto em Markdown, com títulos, listas, ênfase e tabelas, em uma fonte e três tamanhos: pequeno, médio e grande;
- post-its, que são notas em Markdown sobre um cartão amarelo;
- editar, mover e apagar notas e post-its;
- borracha para traços;
- pan e zoom dentro da área;
- desfazer e refazer durante a sessão;
- salvamento local automático;
- o estado **Fixo**, com a área no desktop, abaixo das janelas abertas e sem receber cliques;
- o estado **Edição**, com a área à frente de tudo, foco e toolbar;
- Ctrl + Alt + T para trazer a área para a frente ou fixá-la de novo;
- o botão **Fixar no desktop**, que salva e volta ao estado Fixo;
- o tray com Editar, Fixar no desktop e Sair;
- instância única.

O canvas fica no monitor principal no primeiro ciclo.

## Próximas versões

Estas versões entram depois que a troca entre Fixo e Edição funcionar em uma instalação real, com a L6 e a L7 do [primeiro ciclo](docs/MVP-0-ROADMAP.md) concluídas.

### 0.0.2: escrever mais rápido

Continua uma área, um canvas e um documento. A ordem das camadas está em [ROADMAP-0.0.2.md](docs/ROADMAP-0.0.2.md).

- toolbar de ícones com aba de arrastar em cima, que só aparece com o ponteiro sobre a toolbar, centralizada no rodapé, com posição salva e **Reposicionar toolbar** ([0009](decisions/0009-toolbar-tab-and-icons.md));
- Seleção sem botão, Mão só para a câmera e duplo clique no canvas para escrever ([0010](decisions/0010-implicit-selection-and-hand.md));
- alinhamento à esquerda, ao centro e à direita na nota selecionada;
- popover do Texto com Serifa, Sem serifa e Mono e seis tamanhos;
- popover do Pincel com caneta, marca-texto, borracha e seis cores;
- menu do botão direito em Edição com Reposicionar toolbar, Tema, Área, Ajustar à tela, Zoom e Limpar canvas;
- temas bege, branco, preto, amarelo e transparente;
- documento v2, que migra o documento da 0.0.1 sem perder conteúdo.

### 0.0.3: vários canvases e formas

- ferramenta Novo canvas, que cria outra área no desktop, cada uma com fundo e câmera próprios;
- formas básicas: seta, linha, retângulo e círculo, com seleção, mover e redimensionar;
- seleção de vários elementos;
- janela de configurações, não um painel permanente, com o atalho global e iniciar com o Windows.

Vários canvases mudam o princípio **Um canvas** e precisam de uma decisão própria antes do código.

### 1.0: organizar o desktop

- alinhar os canvases automaticamente na vertical, na horizontal ou em grade, com um atalho que não use Win + setas;
- Fixed Canvas, em que o texto se adapta ao formato da área como uma página, e Infinite Canvas, livre como o canvas atual;
- canvases em outros monitores;
- outros polígonos, como o octógono;
- entrada de voz para texto em anotações rápidas;
- imagens dentro do Markdown, em uma estrutura de texto parecida com a do Obsidian;
- um atalho para mostrar e esconder a toolbar, com animação curta.

## Estados visíveis ao usuário

| Estado | O que o usuário vê | O que o app aceita |
| --- | --- | --- |
| Fixo | A área no desktop, com o fundo escolhido e o conteúdo, sem toolbar | Nenhum clique na área. O desktop e as janelas continuam utilizáveis. |
| Edição | A área à frente das janelas, com o resto da tela escurecido e a toolbar | Desenho, notas, post-its, apagar, desfazer, refazer, o menu do canvas e fixar. |
| Definindo a área | A tela escurecida e o retângulo que o usuário arrasta | Arrastar com o botão esquerdo. É o primeiro passo quando ainda não existe área. |
| Salvando | O mesmo estado de Edição, com um aviso discreto | A edição continua. O app só volta ao estado Fixo depois de salvar. |

Se o salvamento falhar, a área permanece em Edição e mostra uma ação para tentar novamente.

## Atalhos

| Entrada | Ação |
| --- | --- |
| Ctrl + Alt + T | Trazer a área para a frente quando estiver Fixa. Salvar e fixar quando estiver em Edição. |
| Esc | Cancelar a edição de uma nota; sem editor, fechar o popover da ferramenta; sem popover, limpar a seleção; sem seleção, salvar e fixar. Com o menu aberto, só fechar o menu. |
| Alt + F4 | Salvar e fixar, sem encerrar o Canvie. Antes de existir uma área, encerrar o Canvie. |
| H | Mão: arrastar move só a câmera. |
| B | Pincel. |
| T | Texto. |
| P | Post-it. |
| E | Borracha, que fica no popover do Pincel. |
| Botão direito na área, Shift + F10 ou a tecla de menu | Abrir o menu do canvas: Reposicionar toolbar, Tema, Redefinir área, Ajustar à tela, Zoom e Limpar canvas. |
| A letra da ferramenta ativa, ou um clique nela | Voltar para Seleção, o estado sem ferramenta. |
| Clique em uma nota, em Seleção | Selecionar a nota; arrastar move a nota. |
| Delete ou Backspace | Apagar a nota selecionada. |
| Ctrl + Z | Desfazer. |
| Ctrl + Shift + Z ou Ctrl + Y | Refazer. |
| Space + arrastar | Mover a câmera. |
| Scroll | Zoom. |
| Duplo clique em uma nota | Editar a nota. |
| Duplo clique no canvas vazio, em Seleção ou com a Mão | Começar uma nota de texto no ponto. |
| Ctrl + Enter | Concluir a edição de uma nota. |

Os atalhos de letra e de histórico valem apenas em Edição. Edição começa em Seleção. Depois de criar uma nota ou um post-it, o canvas volta para Seleção com a nota selecionada, e uma barra acima dela alinha o texto à esquerda, ao centro ou à direita. Win + T continua reservado pelo Explorer e não é usado pelo produto. O atalho global pode mudar quando houver uma escolha definitiva.

## Critérios de aceite

O primeiro ciclo está pronto quando o usuário consegue:

1. Abrir o Canvie pela primeira vez e arrastar a área do canvas no desktop.
2. Ver a área fixa no desktop, com fundo bege ou transparente, depois de fixá-la.
3. Trabalhar em outro aplicativo sem a área capturar cliques ou cobrir a janela.
4. Usar Ctrl + Alt + T e encontrar a mesma área à frente, com foco e toolbar.
5. Desenhar em três cores, escrever uma nota em Markdown com uma tabela, colar um post-it, apagar e desfazer.
6. Usar Ctrl + Alt + T ou Fixar no desktop e ver a área voltar ao desktop com a alteração.
7. Fechar o processo, abrir o Canvie e encontrar a mesma área e o último documento salvo.
8. Recuperar a edição e sair pelo tray quando o atalho global não puder ser registrado.

## Fora do ciclo

Não entram no primeiro ciclo. Vários canvases, formas e seleção múltipla voltam nas [próximas versões](#próximas-versões).

- contas, nuvem, colaboração ou sincronização;
- múltiplas áreas ou vários canvases;
- formas, setas, grades e conectores;
- seleção múltipla e agrupamento;
- modo de apresentação;
- versões para Linux, macOS ou dispositivos móveis;
- painel permanente de configurações.
