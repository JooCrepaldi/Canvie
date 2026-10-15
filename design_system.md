# Design system

O Canvie usa uma interface pequena, escura e calma, próxima da linguagem visual do Codex e do ChatGPT para desktop. A interface aparece para editar e desaparece quando a área volta a ficar fixa no desktop.

## Direção

O conteúdo ocupa o centro. A toolbar é uma faixa estreita de ícones em preto e branco, com dois grupos. As ações do canvas ficam no menu do botão direito. O app não usa navegação lateral, dashboard ou painel permanente.

O visual do Codex inspira hierarquia, espaçamento, foco e estados de ferramenta. O Canvie não copia telas, ícones ou marcas do ChatGPT.

## Estados

| Estado | Tratamento visual | Regra |
| --- | --- | --- |
| Fixo | Só a área, com o fundo escolhido e o conteúdo | Não mostrar toolbar, borda nem dim. Fora da área, nada é pintado. |
| Edição | Dim fora da área, borda fina na área e toolbar flutuante | Mostrar foco, ferramenta ativa e ação de fixar. |
| Definindo a área | Dim na tela inteira, instrução curta e o retângulo arrastado | Mostrar o tamanho em pixels durante o arraste. |
| Menu aberto | Menu escuro no ponto do clique, sobre a Edição | Esc fecha o menu sem fixar. |
| Confirmando a limpeza | Dim leve e diálogo central Limpar o canvas? | Cancelar começa com o foco. |
| Salvando | Mesmo layout, label curto Salvando… | Não bloquear o canvas. |
| Erro de salvamento | Mensagem curta e ação Tentar novamente | Manter Edição até uma gravação passar. |
| Fixar falhou | Aviso O canvas foi salvo, mas não voltou ao desktop, com Tentar novamente | O documento já está salvo; a área continua em Edição. |
| Documento recuperado | Aviso curto e ação Fechar | Informar que o documento salvo era inválido e que uma cópia foi guardada. |
| Salvamento desativado | Aviso persistente, sem ação | Mostrar enquanto o documento salvo não puder ser lido ou copiado. |

O estado nunca depende apenas de cor. Use label, ícone, foco e posição.

## Tokens iniciais

| Token | Valor | Uso |
| --- | --- | --- |
| font.ui | Segoe UI Variable, Segoe UI, sans-serif | Toolbar e mensagens |
| font.content | Segoe UI Variable, Segoe UI, sans-serif | Notas em Sem serifa, a fonte padrão |
| font.serif | Georgia, Times New Roman, serif | Notas em Serifa |
| font.mono | Cascadia Mono, Consolas, monospace | Notas em Mono |
| size.sm | 12 px | Label auxiliar |
| size.md | 14 px | Botões e texto padrão |
| size.lg | 16 px | Texto de nota |
| space.1 | 4 px | Ícone e label |
| space.2 | 8 px | Padding interno |
| space.3 | 12 px | Grupo de controles |
| space.4 | 16 px | Respiro da toolbar |
| target.min | 32 px | Alvo mínimo de botão |
| target.comfort | 40 px | Ações frequentes |
| color.surface | #202123 | Toolbar, menu e diálogo |
| color.surfaceRaised | #2B2D31 | Grupos da toolbar e popovers |
| color.ink | #F3F4F6 | Texto principal, foco na toolbar e no menu, fundo do Fixar |
| color.inkMuted | #A7A9B0 | Texto auxiliar |
| color.selected | rgba(255,255,255,0.14) | Ferramenta ativa e opção escolhida |
| color.border | rgba(255,255,255,0.12) | Bordas |
| color.accent | #10A37F | Sem uso na 0.0.2: a toolbar é preto e branco ([0009](decisions/0009-toolbar-tab-and-icons.md)) |
| color.danger | #EF4444 | Falha e exclusão |
| color.focus | #60A5FA | Foco de teclado nas notas e nos avisos |
| radius.lg | 14 px | Toolbar e popovers |
| radius.md | 12 px | Menu e diálogo |
| radius.sm | 8 px | Botões |
| shadow.toolbar | 0 10 px 28 px rgba(0,0,0,0.32) | Toolbar, popovers e menu sobre o desktop |
| motion.fast | 120 ms | Hover, foco, menu e barra de alinhamento |
| motion.enter | 220 ms, ease-out | Canvas, escurecimento e toolbar ao entrar em Edição |
| motion.exit | 180 ms, ease-in | Canvas e escurecimento ao fixar |
| motion.settle | 160 ms, ease-out | Canvas ao pousar no desktop, post-it novo |
| ease.out | cubic-bezier(0.2, 0.8, 0.2, 1) | O que entra |
| ease.in | cubic-bezier(0.4, 0, 1, 1) | O que sai |
| color.paper | #F4ECDC | Fundo bege da área |
| color.inkBlack | #1F2328 | Tinta preta e texto das notas |
| color.inkBlue | #2563EB | Tinta azul |
| color.inkRed | #DC2626 | Tinta vermelha |
| color.inkGreen | #16A34A | Tinta verde |
| color.inkYellow | #FACC15 | Tinta amarela, a do marca-texto clássico |
| color.inkWhite | #F8FAFC | Tinta branca, legível sobre o tema preto |
| brush.pen | 3 px, opaca | Caneta |
| brush.highlighter | 18 px, 35% de opacidade | Marca-texto |
| color.postit | #FDE68A | Cartão do post-it |
| color.dim | rgba(0,0,0,0.32) | Escurecimento fora da área em Edição |
| note.xs | 12 px | Nota muito pequena |
| note.small | 14 px | Nota pequena |
| note.medium | 18 px | Nota média, o tamanho padrão |
| note.large | 24 px | Nota grande |
| note.xl | 32 px | Nota muito grande |
| note.xxl | 48 px | Nota extra grande |

Use a fonte e a escala do Windows. Respeite alto contraste e redução de movimento.

## Toolbar

A toolbar segue a [0009](decisions/0009-toolbar-tab-and-icons.md). Ela:

- aparece apenas em Edição;
- abre centralizada no rodapé do monitor, 20 px acima da taskbar;
- tem a aba de arrastar centralizada acima da barra, escondida em repouso;
- salva a posição arrastada como preferência, fora do documento;
- tem foco visível, nome acessível e tooltip com o atalho em cada botão;
- mantém **Fixar no desktop** sempre visível.

Ordem:

           (aba)
    [Texto] [Post-it] [Pincel] [Mão] | [Fixar]

A barra usa color.surface e radius.lg. Cada grupo usa color.surfaceRaised. Os botões têm 40 px, com ícones do Lucide de 20 px e traço 1,75. A ferramenta ativa usa color.selected; nenhuma cor de destaque aparece na barra. A Borracha mantém o Pincel pressionado, porque ela mora no popover dele.

Fixar é o único botão sólido: fundo color.ink e alfinete #111214. O nome acessível e o tooltip dizem Fixar no desktop, atalho Ctrl + Alt + T. Sem área, o botão fica desativado com 40% de opacidade. Salvando… aparece num aviso acima da barra.

A aba é uma lingueta de 64 × 24 px que sai da borda de cima da barra, com o ícone de pontos na horizontal. Cantos côncavos de 10 px fazem a concordância com a barra, e o contorno fino da barra continua em volta da aba. Ela nunca cobre os botões, e o alvo de clique tem 32 px de altura. O foco do teclado desenha o anel por dentro da aba. Ela aparece em motion.fast quando o ponteiro está sobre a toolbar, quando um controle dela tem o foco ou durante o arraste. Ela some 300 ms depois que o ponteiro sai. Com redução de movimento, aparece sem animação. Só a aba arrasta, e a posição fica limitada para a aba continuar na tela.

Os popovers abrem 40 px acima da barra, em color.surfaceRaised e radius.lg:

- **Pincel e Borracha:** Caneta, Marca-texto e Borracha, um divisor e as seis amostras de tinta de 26 px. A opção ativa usa color.selected com um contorno interno branco; a tinta ativa ganha um anel branco de 2 px.
- **Texto e Post-it:** Serifa, Sem serifa e Mono, cada botão escrito na própria fonte, um divisor e os seis tamanhos, como botões "A" de 40 × 40 px. Fonte e tamanho também aparecem enquanto qualquer nota está sendo escrita, nova ou existente.

Um popover é mais largo que a barra. Perto de uma lateral da tela, ele desliza para ficar a 8 px da borda. Perto do topo, abre 12 px abaixo da barra.

## Menu do canvas

O menu do botão direito guarda as ações do canvas que saíram da barra.

- Abre no ponto do clique, só dentro da área e só em Edição. Shift + F10 e a tecla de menu abrem no centro da área. O botão direito nunca desenha, apaga nem escreve.
- Tem 232 px de largura, color.surface e radius.md. Os itens têm 32 px. Hover e foco usam branco a 10%, e o foco do teclado ganha um contorno interno de 2 px em color.ink.
- A ordem é: Reposicionar toolbar | Tema, com Bege, Branco, Preto, Amarelo e Transparente | Redefinir área, Ajustar à tela e Zoom com 50%, 100%, 200% e um campo | Limpar canvas…
- Cada tema mostra uma amostra, e o atual ganha um check, além do estado marcado para leitores de tela.
- Limpar canvas… usa vermelho claro (#FCA5A5) e abre o diálogo Limpar o canvas?, com Cancelar e Limpar em color.danger.
- O menu fica dentro da tela. No editor de nota, o botão direito mostra o menu nativo do WebView, para recortar, copiar e colar.

## Canvas

A área é o único lugar pintado. No estado Fixo, ela mostra o fundo escolhido e o conteúdo, sem moldura. Em Edição, ganha uma borda fina, e o resto da tela recebe o dim.

Notas usam uma das três fontes, texto em color.inkBlack e um dos seis tamanhos. Sobre o tema preto, o texto das notas usa color.ink. Títulos do Markdown crescem a partir desse tamanho. Tabelas têm bordas finas. Post-its são cartões color.postit com sombra curta e texto em color.inkBlack. Sobre o fundo transparente, a legibilidade depende do wallpaper; o post-it é a opção para texto sempre legível.

Escrever uma nota não mostra caixa. O editor fica no lugar exato da nota, sem borda, fundo, contorno ou texto de exemplo, e só o cursor pisca. O texto cresce no lugar em que a nota vai aparecer. O post-it mantém o próprio cartão enquanto é escrito.

## Movimento

O movimento conta de onde a coisa vem e para onde vai. Ele é curto, nunca bloqueia a escrita e some com a redução de movimento do Windows. As regras estão em motion.css.

- **Entrar em Edição:** o canvas aparece com fade e sobe 12 px em motion.enter. O escurecimento entra junto, e a toolbar sobe 10 px 60 ms depois. Antes de a janela subir, o canvas já espera invisível na pose de partida, para nunca piscar à frente das outras janelas.
- **Fixar:** o save vem primeiro. Depois, o canvas desce 12 px com fade em motion.exit, a toolbar e a barra de alinhamento descem 10 px em 140 ms, e o canvas não recebe ponteiro. Só então a janela volta ao desktop, onde o canvas pousa com fade em motion.settle.
- **Camadas:** popovers, menu e diálogo abrem com fade e escala de 0,96 para 1, a partir do ponto de onde nascem. A barra de alinhamento sobe 4 px com fade. O fundo do diálogo, o seletor de área e os avisos entram com fade.
- **Notas:** a nota concluída entra com fade em 140 ms; o post-it novo pousa com escala de 0,96 para 1. O anel da seleção cresce a partir da nota em motion.fast, e uma nota que pode ser arrastada mostra um halo neutro sob o ponteiro.
- **Botões:** hover e estado ativo mudam em motion.fast. Ao clicar, um botão afunda para 0,94 em 80 ms. As amostras de tinta crescem para 1,08 no hover.
- **Traço:** o desenho passa curvas pelos pontos médios das amostras do ponteiro.
- **Redução de movimento:** nenhuma animação, nenhuma transição e nenhuma espera antes de fixar.

O movimento usa as propriedades `translate` e `scale`, que se somam às transformações que posicionam a toolbar, os popovers e o diálogo.

## Interação

- O foco inicial de Edição vai para o canvas ou para a primeira ferramenta.
- Tab percorre a aba, as ferramentas e Fixar, nessa ordem; com um popover aberto, as opções dele vêm depois.
- Esc cancela o editor aberto; sem editor, fecha o popover; sem popover, limpa a seleção; sem seleção, salva e volta à Parede. Com o menu ou o diálogo aberto, Esc só fecha o menu ou cancela o diálogo.
- No menu, as setas, Home e End percorrem os itens, e Tab e Shift + Tab ficam dentro do menu e chegam ao campo do zoom. No diálogo de limpeza, o foco começa em Cancelar e Tab alterna entre os dois botões.
- A nota selecionada ganha um contorno escuro de 1,5 px, a 6 px dela, com um halo claro, sem cor de destaque. Uma barra contextual escura, com três botões de 32 px para alinhar, fica 46 px acima do canto da nota. O botão ativo usa branco translúcido.
- Tooltips mostram nome e atalho depois de um pequeno atraso. Eles não substituem o nome acessível.
- O arraste começa apenas na aba.
- Um botão nunca move a toolbar.

## Acessibilidade

Todo controle tem nome acessível em pt-BR, foco visível e equivalente de teclado. O estado da ferramenta aparece por ícone, label e tratamento visual. No editor de nota, o cursor de texto é o sinal de foco.

Verifique as escalas 100%, 125%, 150% e 200%, o Narrador do Windows, alto contraste e redução de movimento. Os alvos de toque não ficam menores que 32 px.

## Evite

- painel permanente;
- menu profundo para a ação de fixar;
- texto de estado que some antes de ser lido;
- foco invisível;
- animações longas;
- emoji como único ícone;
- cor como único sinal de modo;
- uma toolbar inteira arrastável.
