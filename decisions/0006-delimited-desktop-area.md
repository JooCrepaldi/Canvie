# 0006: tratar o canvas como uma área delimitada do desktop

- **Status:** aceito
- **Data:** 2026-10-13
- **Escopo:** produto, janela, documento e interface

## Contexto

A proposta anterior tratava o Canvie como uma parede: um canvas transparente do tamanho do desktop, preso atrás das janelas. O criador do produto redefiniu a direção. O Canvie passa a ser uma parte delimitada do desktop, escolhida pelo usuário ao arrastar um retângulo. O conteúdo inclui desenhos, notas em Markdown e post-its. A transparência deixa de ser obrigatória e vira uma opção de fundo.

A troca rápida continua sendo o centro do produto: um atalho traz a área para a frente das janelas, e o mesmo atalho salva e devolve a área ao desktop.

## Decisão

- O app mantém uma janela Tauri e os placements Wall e Edit da [0005](0005-wall-to-edit-transition.md). No produto, Wall se chama **Fixo**.
- A janela cobre o monitor principal nos dois placements. A área é um retângulo dentro da página, guardado no documento em pixels CSS do monitor.
- Em Wall, a janela fica no desktop, transparente fora da área e sem receber cliques em nenhum ponto. Em Edit, a janela fica à frente de tudo, escurece a tela fora da área e mostra a toolbar.
- Quando não existe área salva, o app abre em Edit para o usuário arrastar o retângulo. A ação Área redefine o retângulo em Edit.
- O documento guarda a área e o fundo. O primeiro ciclo oferece o fundo bege e o transparente.
- Notas e post-its guardam Markdown e são renderizados em HTML sobre o canvas. O Markdown não aceita HTML bruto. A escolha do parser está em [0007](0007-markdown-notes.md).
- O primeiro ciclo tem um pincel com preto, azul e vermelho, e uma fonte com os tamanhos pequeno, médio e grande.

## Consequências

- A toolbar e a seleção da área usam o espaço fora do retângulo, então funcionam mesmo com uma área pequena.
- A janela não muda de tamanho entre Wall e Edit. Só muda o parent, a ordem Z, o foco e o click-through.
- Wall com fundo bege esconde os ícones que ficam embaixo da área. Isso é parte da escolha do usuário ao posicionar o retângulo.
- Uma mudança de resolução pode deixar a área fora da tela. O carregamento limita o retângulo ao monitor.
- O documento v1 ainda não foi distribuído, então ganha os campos novos sem migração. Um payload antigo cai no fluxo de documento inválido, com cópia local.
- Fixo é o termo do produto. Wall continua sendo o nome do placement no código e nos documentos de arquitetura.

## Alternativas consideradas

- **Janela do tamanho da área.** Rejeitada porque a toolbar e o arraste do retângulo precisam de espaço fora da área, e redimensionar a janela nativa em cada mudança somaria trabalho de DPI e de Win32.
- **Manter o canvas do tamanho do wallpaper.** Substituída por esta direção.
- **Texto simples.** Rejeitado porque o produto precisa de hierarquia e tabelas nas notas.
