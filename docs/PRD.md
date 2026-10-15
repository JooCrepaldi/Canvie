# Canvie: PRD do primeiro ciclo

Este documento congela o comportamento que a primeira implementação precisa entregar, na direção registrada em [product.md](../product.md) e na decisão [0006](../decisions/0006-delimited-desktop-area.md). O scaffold Tauri, o canvas de edição e o documento persistente já existem nas camadas L0, L1 e L2. A área, o conteúdo em Markdown e a integração com o desktop entram nas camadas seguintes do [roadmap](MVP-0-ROADMAP.md).

## 1. Problema

O usuário tem uma ideia enquanto trabalha em outro aplicativo. Abrir um whiteboard, encontrar o documento e voltar ao trabalho demora mais do que a anotação.

## 2. Resultado esperado

O usuário mantém uma área de anotação fixa em um canto do desktop que ele escolheu. Ele chama o Canvie com um atalho, edita a mesma área à frente das janelas e usa o atalho de novo, ou o botão **Fixar no desktop**. A área volta ao desktop com o conteúdo salvo.

## 3. Escopo

O produto tem uma área, um canvas e um documento, locais e no monitor principal. O primeiro ciclo inclui:

- área definida ao arrastar um retângulo, salva e redefinível;
- tema da área em bege, branco, preto, amarelo ou transparente;
- um pincel com caneta e marca-texto, em seis tintas;
- notas em Markdown em três fontes e seis tamanhos;
- post-its;
- editar, mover e apagar notas;
- borracha;
- undo e redo;
- câmera com pan e zoom dentro da área;
- persistência local;
- Fixo e Edição;
- toolbar de ícones, movível pela aba, e menu do botão direito com as ações do canvas;
- tray com Editar, Fixar no desktop, Reposicionar toolbar e Sair, e instância única.

Imagens, voz para texto, múltiplos documentos, formas e outras cores ficam fora deste PRD.

## 4. Comportamento

### Definir a área

Quando não existe área salva, o app abre em Edição com a tela escurecida e a instrução para arrastar. O usuário pressiona o botão esquerdo, arrasta e solta. O retângulo vira a área do canvas e é salvo no documento. **Redefinir área**, no menu do botão direito, repete esse passo e mantém o conteúdo. Uma área menor que 160 × 120 pixels é recusada e o app pede outro arraste.

### Fixo

A janela cobre o monitor principal, é filha de Progman, transparente fora da área e click-through em toda a superfície. A área mostra o fundo escolhido e o conteúdo. Ela fica acima dos ícones do desktop e abaixo das janelas comuns e da taskbar. A toolbar não aparece.

### Edição

Ctrl + Alt + T ou o tray chamam Edição. A mesma janela:

1. deixa de ser filha de Progman;
2. vira top-level e fica sempre no topo;
3. recebe foco;
4. escurece a tela fora da área e mostra a toolbar;
5. libera desenho, notas, post-its e o menu do canvas.

O frontend recebe o evento de estado do backend. Ele não inventa Edição em React.

### Conteúdo

- O pincel desenha na cor selecionada. A borracha remove os traços e as notas que tocar.
- A ferramenta Texto cria uma nota no ponto clicado e abre o editor de texto. A ferramenta Post-it faz o mesmo sobre um cartão amarelo.
- O editor mostra o Markdown bruto, sem caixa: só o cursor aparece, no lugar onde a nota vai ficar. Ctrl + Enter ou um clique fora conclui; Esc cancela. Uma nota esvaziada é removida.
- Fora do editor, a nota mostra o Markdown renderizado: títulos, listas, ênfase, código, citações e tabelas. HTML escrito pelo usuário aparece como texto, e links não navegam.
- Edição começa em Seleção, o estado sem ferramenta pressionada. Em Seleção, um clique seleciona uma nota ou um post-it, arrastar move, Delete ou Backspace apaga, e uma barra acima da nota alinha o texto. Um duplo clique no canvas vazio, em Seleção ou com a Mão, começa uma nota de texto; um duplo clique numa nota a edita. A Mão (H) arrasta só a câmera. A letra da ferramenta ativa, ou um clique nela, volta para Seleção, e criar uma nota ou um post-it também volta, com o item selecionado. Escolher uma tinta escolhe o Pincel ([0010](../decisions/0010-implicit-selection-and-hand.md)).
- Fonte e tamanho ficam no popover do Texto e do Post-it, que também aparece enquanto qualquer nota está sendo escrita. Eles valem para a próxima nota e para a nota em edição. As fontes são Serifa (Georgia), Sem serifa (Segoe UI Variable) e Mono (Cascadia Mono, com Consolas de reserva); os tamanhos vão de 12 a 48 px.
- O Pincel desenha com a Caneta, opaca, ou com o Marca-texto, largo e a 35% de opacidade, em seis tintas: preta, azul, vermelha, verde, amarela e branca. Os traços ficam abaixo das notas, então o marca-texto nunca esconde o texto.

### Toolbar e menu

- A toolbar tem [Texto, Post-it, Pincel, Mão] e [Fixar]. O Pincel abre um popover com Caneta, Marca-texto, Borracha e as seis tintas. Desfazer e Refazer ficam só no teclado ([0009](../decisions/0009-toolbar-tab-and-icons.md)).
- A toolbar abre centralizada acima da taskbar. A aba acima dela aparece com o ponteiro ou com o foco e arrasta a toolbar. A posição arrastada fica salva como preferência. Uma posição inválida ou fora da tela volta ao padrão e registra um aviso. **Reposicionar toolbar**, no menu ou no tray, volta ao padrão.
- O botão direito dentro da área, Shift + F10 ou a tecla de menu abrem o menu do canvas: Reposicionar toolbar, Tema, Redefinir área, Ajustar à tela, Zoom e Limpar canvas. O Zoom tem 50%, 100%, 200% e um campo, limitado de 25% a 400%. Ajustar à tela enquadra todo o conteúdo com margem; num canvas vazio, volta à câmera padrão.
- Limpar canvas pede confirmação, mantém a área, o tema e a câmera, e Ctrl + Z desfaz. O botão direito nunca desenha, apaga nem escreve.

### Fixar no desktop

O botão **Fixar no desktop**, Esc fora do editor, Ctrl + Alt + T e Alt + F4 iniciam a mesma transição. Antes de existir uma área, Alt + F4 grava o save pendente e encerra o app, porque não há o que fixar:

1. o frontend conclui a nota em edição e mostra Salvando;
2. persistence.ts conclui saveNow;
3. se falhar, o app permanece em Edição e mostra Tentar novamente;
4. se passar, o backend reparenta a janela no Progman;
5. o backend reativa click-through e remove always-on-top;
6. o backend emite Wall;
7. o frontend esconde a toolbar e o escurecimento.

Desde a L13, entre o passo 2 e o passo 4 o canvas desce e esmaece por 180 ms, e ao chegar no desktop ele pousa com um fade. Ao entrar em Edição, o canvas aparece com fade e sobe. A redução de movimento do Windows tira essas animações.

O app não confirma a troca antes de salvar. Sem área definida, a transição pede o arraste antes de fixar.

## 5. Atalhos

| Atalho | Ação | Escopo |
| --- | --- | --- |
| Ctrl + Alt + T | Chama ou fixa a área | Global |
| Esc | Cancela a nota em edição; sem editor, fecha o popover; sem popover, limpa a seleção; sem seleção, salva e fixa. Com o menu aberto, só fecha o menu | Edição |
| Alt + F4 | Salva e fixa, sem encerrar o app; sem área, encerra o app | Edição |
| H | Mão | Edição |
| B | Pincel | Edição |
| T | Texto | Edição |
| P | Post-it | Edição |
| E | Borracha, no popover do Pincel | Edição |
| Botão direito na área, Shift + F10 ou tecla de menu | Abre o menu do canvas | Edição |
| Letra da ferramenta ativa | Volta para Seleção | Edição |
| Delete ou Backspace | Apaga a nota selecionada | Seleção |
| Duplo clique no canvas vazio | Começa uma nota de texto | Seleção e Mão |
| Ctrl + Z | Desfazer | Edição |
| Ctrl + Shift + Z ou Ctrl + Y | Refazer | Edição |
| Ctrl + Enter | Concluir a nota | Editor de nota |
| Space + arrastar | Pan | Edição |
| Scroll | Zoom | Edição |

O produto não usa Win + T porque o Explorer reserva a combinação.

## 6. Modelo do documento

    CanvasDoc {
      version: 2,
      revision: number,
      area: { x, y, width, height } | null,
      background: 'paper' | 'white' | 'black' | 'yellow' | 'transparent',
      strokes: Stroke[],
      notes: Note[],
      camera: Camera
    }

    Stroke { id, points, color, width, brush: 'pen' | 'highlighter' }
    Note { id, x, y, text, size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl', font: 'serif' | 'sans' | 'mono', align: 'left' | 'center' | 'right', kind: 'text' | 'postit' }

O formato é o v2 desde a L8 da 0.2. A interface oferece todos os valores desde a L12: os cinco temas, o alinhamento, as três fontes, os seis tamanhos e os dois pincéis. Um documento v1 é migrado sem perda ([0011](../decisions/0011-document-v2-storage.md)).

A área usa pixels CSS do monitor principal. O documento não guarda o estado da janela: Fixo e Edição são estado de runtime. A posição da toolbar é uma preferência separada.

## 7. Falhas

| Falha | Resultado |
| --- | --- |
| JSON inválido | Abrir um documento vazio, guardar o payload inválido para diagnóstico e registrar aviso |
| documento salvo ilegível ou sem cópia possível | Abrir um documento vazio, não salvar na sessão e avisar o usuário |
| save automático falha | Manter o último documento válido no armazenamento e a edição em memória, mostrar Tentar novamente |
| saveNow falha | Permanecer em Edição, preservar o documento em memória e mostrar Tentar novamente |
| área fora da tela depois de mudar a resolução | Limitar a área ao monitor principal |
| atalho ocupado | Iniciar o app, registrar aviso e manter Editar no tray |
| capacidade negada | Iniciar com o recurso afetado desativado e registrar a causa |
| Explorer reinicia | Esperar o novo Progman e a camada de ícones e reiniciar o Canvie, que volta ao desktop com o documento salvo |
| API Tauri ausente | Usar fallback de navegador para editar e testar o canvas |

## 8. Critérios de aceite

O PRD passa quando uma build instalada demonstra:

1. primeira abertura em Edição pedindo o arraste da área;
2. área visível no desktop depois de fixar, com fundo bege e com fundo transparente;
3. cliques do desktop e das janelas livres enquanto a área está Fixa;
4. Ctrl + Alt + T trazendo o mesmo documento para Edição com outro app aberto;
5. toolbar visível, focável e movível pela aba;
6. traço nas três cores, nota com tabela, post-it, borracha, undo e redo funcionais;
7. Fixar no desktop e o atalho salvando antes de reparentar;
8. área e conteúdo restaurados depois de fechar e abrir;
9. tray e single-instance funcionais;
10. RAM em repouso e CPU registrados em docs/OPERATIONS.md.
