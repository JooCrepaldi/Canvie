# Canvie: PRD do primeiro ciclo

Este documento congela o comportamento que a primeira implementação precisa entregar, na direção registrada em [product.md](../product.md) e na decisão [0006](../decisions/0006-delimited-desktop-area.md). O scaffold Tauri, o canvas de edição e o documento persistente já existem nas camadas L0, L1 e L2. A área, o conteúdo em Markdown e a integração com o desktop entram nas camadas seguintes do [roadmap](MVP-0-ROADMAP.md).

## 1. Problema

O usuário tem uma ideia enquanto trabalha em outro aplicativo. Abrir um whiteboard, encontrar o documento e voltar ao trabalho demora mais do que a anotação.

## 2. Resultado esperado

O usuário mantém uma área de anotação fixa em um canto do desktop que ele escolheu. Ele chama o Canvie com um atalho, edita a mesma área à frente das janelas e usa o atalho de novo, ou o botão **Fixar no desktop**. A área volta ao desktop com o conteúdo salvo.

## 3. Escopo

O produto tem uma área, um canvas e um documento, locais e no monitor principal. O primeiro ciclo inclui:

- área definida ao arrastar um retângulo, salva e redefinível;
- fundo bege ou transparente;
- um pincel em preto, azul ou vermelho;
- notas em Markdown com uma fonte em três tamanhos;
- post-its;
- editar, mover e apagar notas;
- borracha;
- undo e redo;
- câmera com pan e zoom dentro da área;
- persistência local;
- Fixo e Edição;
- toolbar compacta e móvel pelo pegador;
- tray com Editar, Fixar no desktop e Sair, e instância única.

Imagens, voz para texto, múltiplos documentos, formas e outras cores ficam fora deste PRD.

## 4. Comportamento

### Definir a área

Quando não existe área salva, o app abre em Edição com a tela escurecida e a instrução para arrastar. O usuário pressiona o botão esquerdo, arrasta e solta. O retângulo vira a área do canvas e é salvo no documento. A ação **Área** da toolbar repete esse passo e mantém o conteúdo. Uma área menor que 160 × 120 pixels é recusada e o app pede outro arraste.

### Fixo

A janela cobre o monitor principal, é filha de Progman, transparente fora da área e click-through em toda a superfície. A área mostra o fundo escolhido e o conteúdo. Ela fica acima dos ícones do desktop e abaixo das janelas comuns e da taskbar. A toolbar não aparece.

### Edição

Ctrl + Alt + T ou o tray chamam Edição. A mesma janela:

1. deixa de ser filha de Progman;
2. vira top-level e fica sempre no topo;
3. recebe foco;
4. escurece a tela fora da área e mostra a toolbar;
5. libera desenho, notas, post-its e a ação Área.

O frontend recebe o evento de estado do backend. Ele não inventa Edição em React.

### Conteúdo

- O pincel desenha na cor selecionada. A borracha remove os traços e as notas que tocar.
- A ferramenta Nota cria uma nota no ponto clicado e abre o editor de texto. A ferramenta Post-it faz o mesmo sobre um cartão amarelo.
- O editor mostra o Markdown bruto. Ctrl + Enter ou um clique fora conclui; Esc cancela. Uma nota esvaziada é removida.
- Fora do editor, a nota mostra o Markdown renderizado: títulos, listas, ênfase, código, citações e tabelas. HTML escrito pelo usuário aparece como texto, e links não navegam.
- Duplo clique edita uma nota. A ferramenta Mover arrasta uma nota quando o clique começa nela e move a câmera quando começa no fundo.
- O tamanho selecionado na toolbar vale para a próxima nota e para a nota em edição.

### Fixar no desktop

O botão **Fixar no desktop**, Esc fora do editor, Ctrl + Alt + T e Alt + F4 iniciam a mesma transição. Antes de existir uma área, Alt + F4 grava o save pendente e encerra o app, porque não há o que fixar:

1. o frontend conclui a nota em edição e mostra Salvando;
2. persistence.ts conclui saveNow;
3. se falhar, o app permanece em Edição e mostra Tentar novamente;
4. se passar, o backend reparenta a janela no Progman;
5. o backend reativa click-through e remove always-on-top;
6. o backend emite Wall;
7. o frontend esconde a toolbar e o escurecimento.

O app não confirma a troca antes de salvar. Sem área definida, a transição pede o arraste antes de fixar.

## 5. Atalhos

| Atalho | Ação | Escopo |
| --- | --- | --- |
| Ctrl + Alt + T | Chama ou fixa a área | Global |
| Esc | Salva e fixa; cancela a nota em edição | Edição |
| Alt + F4 | Salva e fixa, sem encerrar o app; sem área, encerra o app | Edição |
| B | Pincel | Edição |
| T | Nota | Edição |
| P | Post-it | Edição |
| E | Borracha | Edição |
| Ctrl + Z | Desfazer | Edição |
| Ctrl + Shift + Z ou Ctrl + Y | Refazer | Edição |
| Ctrl + Enter | Concluir a nota | Editor de nota |
| Space + arrastar | Pan | Edição |
| Scroll | Zoom | Edição |

O produto não usa Win + T porque o Explorer reserva a combinação.

## 6. Modelo do documento

    CanvasDoc {
      version: 1,
      revision: number,
      area: { x, y, width, height } | null,
      background: 'paper' | 'transparent',
      strokes: Stroke[],
      notes: Note[],
      camera: Camera
    }

    Stroke { id, points, color, width }
    Note { id, x, y, text, size: 'small' | 'medium' | 'large', kind: 'text' | 'postit' }

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
5. toolbar visível, focável e movível pelo pegador;
6. traço nas três cores, nota com tabela, post-it, borracha, undo e redo funcionais;
7. Fixar no desktop e o atalho salvando antes de reparentar;
8. área e conteúdo restaurados depois de fechar e abrir;
9. tray e single-instance funcionais;
10. RAM em repouso e CPU registrados em docs/OPERATIONS.md.
