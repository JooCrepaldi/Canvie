# 0009: toolbar de ícones com aba de arrastar em cima

- **Status:** aceito
- **Data:** 2026-10-13
- **Escopo:** interface, interação e dependências

## Contexto

A toolbar da 0.0.1 usa rótulos em texto e mostra todas as opções de uma vez: ferramentas, cores, tamanhos, fundo, área, histórico e **Fixar no desktop**. O criador do produto desenhou uma toolbar nova em duas variantes. As duas têm os mesmos grupos: criação (Texto, Post-it, Pincel, Formas e Mão) e canvas (Novo canvas e Fixar). Uma variante põe o pegador à esquerda. A outra põe o pegador em uma aba centralizada acima da barra.

A [0004](0004-toolbar-movable-and-persistent.md) define o pegador separado, a posição salva e a escolha entre orientação horizontal e vertical.

## Decisão

- O pegador é uma aba centralizada acima da barra, com o ícone de pontos na horizontal. Só a aba arrasta a toolbar. A aba tem pelo menos 32 px de altura, e a posição é limitada para a aba continuar na tela.
- A aba fica escondida em repouso. Ela aparece, em 120 ms, quando o ponteiro está sobre a toolbar, incluindo a própria aba e um popover aberto, ou quando um controle da toolbar tem o foco do teclado. Ela some com um pequeno atraso depois que o ponteiro sai, para não piscar entre a barra e a aba, e não some durante um arraste. Com redução de movimento, aparece sem animação.
- Popovers e tooltips abrem acima da altura da aba, porque ela aparece sempre que o ponteiro está na toolbar.
- A barra tem dois grupos: [Texto, Post-it, Pincel, Formas, Mão] e [Novo canvas, Fixar]. Um botão só aparece quando a função existe. Na 0.2, a barra mostra [Texto, Post-it, Pincel, Mão] e [Fixar].
- Os ícones vêm do Lucide (`lucide-react`, licença ISC), importados um a um: `type`, `sticky-note`, `pen-tool`, `square`, `hand`, `hash`, `pin` e `grip-horizontal`.
- **Fixar no desktop** usa o alfinete, sem texto, sobre um fundo destacado no fim da barra. O tooltip e o nome acessível dizem "Fixar no desktop, atalho Ctrl + Alt + T". Salvando… e Tentar novamente aparecem em um aviso junto da toolbar.
- Texto e Pincel abrem popovers acima da barra com os [valores prontos](0008-preset-values.md). A Borracha fica no popover do Pincel, e a tecla E continua ativando-a.
- A toolbar não tem botões de Desfazer e Refazer. O histórico fica no teclado: Ctrl + Z, Ctrl + Shift + Z e Ctrl + Y.
- Fundo e Área saem da toolbar e vão para o menu do botão direito, como Tema e Área.
- A posição padrão é centralizada no rodapé do monitor, acima da taskbar. A posição continua salva como preferência, como na 0004. **Reposicionar toolbar** fica no menu do botão direito e no tray.
- A toolbar só tem orientação horizontal.
- A toolbar é preto e branco, sem cor de destaque; o verde `color.accent` sai dela. Ferramenta ativa e opção selecionada nos popovers usam um branco translúcido. Fixar, a ação principal, usa branco sólido com ícone preto na variante escura e preto sólido com ícone branco na clara. A seleção de uma nota também fica sem cor. Só as amostras de tinta têm cor.
- A escolha entre a variante escura e a clara do wireframe fica para a L11, registrada em [design_system.md](../design_system.md).

## Consequências

- A 0004 continua valendo para o pegador separado e a posição salva. A orientação vertical e a posição padrão no topo deixam de valer.
- A regra do design system que pede texto no botão de fixar muda quando a L11 da [0.2](../docs/ROADMAP-0.2.md) for entregue.
- O ícone de cantos de enquadramento fica para Ajustar à tela, no menu do botão direito.
- Desfazer pelo mouse deixa de existir.
- No toque não existe hover, então a aba não aparece. Mover a toolbar pelo toque fica fora da 0.2, e **Reposicionar toolbar** continua sendo a rota de volta.
- A barra em repouso fica mais limpa, mas mover a toolbar exige descobrir a aba passando o ponteiro. O tooltip dos botões não substitui essa descoberta.
- O `lucide-react` é uma dependência nova. A L11 mede o aumento do bundle.

## Alternativas consideradas

- **Pegador à esquerda.** Rejeitada porque desloca o peso visual quando a barra fica centralizada. Ela só seria melhor numa barra vertical, que não está no produto.
- **Cantos de enquadramento para Fixar.** Rejeitada porque o ícone é lido como tela cheia e colide com Ajustar à tela.
- **Texto no botão Fixar.** Rejeitada pelo criador em favor de uma barra só de ícones. O destaque, a posição final e o tooltip marcam a ação principal.
- **Ícones próprios ou emoji.** Rejeitada pelo custo de desenho e porque o design system não aceita emoji como único ícone.
