# Design system

O Canvie usa uma interface pequena, escura e calma, próxima da linguagem visual do Codex e do ChatGPT para desktop. A interface aparece para editar e desaparece quando a área volta a ficar fixa no desktop.

## Direção

O conteúdo ocupa o centro. A toolbar é uma faixa estreita, com poucos grupos e rótulos claros. O app não usa navegação lateral, dashboard ou painel permanente.

O visual do Codex inspira hierarquia, espaçamento, foco e estados de ferramenta. O Canvie não copia telas, ícones ou marcas do ChatGPT.

## Estados

| Estado | Tratamento visual | Regra |
| --- | --- | --- |
| Fixo | Só a área, com o fundo escolhido e o conteúdo | Não mostrar toolbar, borda nem dim. Fora da área, nada é pintado. |
| Edição | Dim fora da área, borda fina na área e toolbar flutuante | Mostrar foco, ferramenta ativa e ação de fixar. |
| Definindo a área | Dim na tela inteira, instrução curta e o retângulo arrastado | Mostrar o tamanho em pixels durante o arraste. |
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
| font.content | Segoe UI Variable, Segoe UI, sans-serif | Notas e texto no canvas |
| size.sm | 12 px | Label auxiliar |
| size.md | 14 px | Botões e texto padrão |
| size.lg | 16 px | Texto de nota |
| space.1 | 4 px | Ícone e label |
| space.2 | 8 px | Padding interno |
| space.3 | 12 px | Grupo de controles |
| space.4 | 16 px | Respiro da toolbar |
| target.min | 32 px | Alvo mínimo de botão |
| target.comfort | 40 px | Ações frequentes |
| color.surface | #202123 | Toolbar padrão |
| color.surfaceRaised | #2B2D31 | Hover e menu |
| color.ink | #F3F4F6 | Texto principal |
| color.inkMuted | #A7A9B0 | Texto auxiliar |
| color.border | rgba(255,255,255,0.12) | Bordas |
| color.accent | #10A37F | Ferramenta ativa e ação principal |
| color.danger | #EF4444 | Falha e exclusão |
| color.focus | #60A5FA | Foco de teclado |
| radius.md | 10 px | Toolbar |
| radius.sm | 6 px | Botões |
| shadow.toolbar | 0 8 px 24 px rgba(0,0,0,0.24) | Toolbar sobre o desktop |
| motion.fast | 120 ms | Hover e foco |
| color.paper | #F4ECDC | Fundo bege da área |
| color.inkBlack | #1F2328 | Tinta preta e texto das notas |
| color.inkBlue | #2563EB | Tinta azul |
| color.inkRed | #DC2626 | Tinta vermelha |
| color.postit | #FDE68A | Cartão do post-it |
| color.dim | rgba(0,0,0,0.32) | Escurecimento fora da área em Edição |
| note.small | 14 px | Nota pequena |
| note.medium | 18 px | Nota média |
| note.large | 24 px | Nota grande |

Use a fonte e a escala do Windows. Respeite alto contraste e redução de movimento.

## Toolbar

Esta seção descreve a toolbar da 0.0.1. A toolbar de ícones da [0009](decisions/0009-toolbar-tab-and-icons.md) substitui esta ordem quando a L11 do [roadmap da 0.0.2](docs/ROADMAP-0.0.2.md) for entregue.

A toolbar:

- aparece apenas em Edição;
- tem o pegador em uma extremidade;
- mantém o pegador separado dos botões;
- pode ser movida pelo pegador;
- salva posição, monitor e orientação;
- não muda de tamanho quando um tooltip abre;
- tem foco visível e nomes acessíveis;
- mantém **Fixar no desktop** sempre visível.

Ordem padrão:

    [pegador] [mover] [pincel] [nota] [post-it] [borracha] | [preto] [azul] [vermelho] | [P] [M] [G] | [fundo] [área] | [desfazer] [refazer] | [Fixar no desktop]

O botão de fixar usa texto, não apenas um ícone, com contorno color.accent que preenche no hover. Ele mostra Salvando… enquanto a transição salva, e fica desativado enquanto não existe área. A ação é a saída principal da Edição. As cores mostram a amostra e têm nome acessível; a cor ativa também ganha contorno, não só destaque de cor.

## Canvas

A área é o único lugar pintado. No estado Fixo, ela mostra o fundo escolhido e o conteúdo, sem moldura. Em Edição, ganha uma borda fina, e o resto da tela recebe o dim.

Notas usam a fonte de conteúdo, texto em color.inkBlack e um dos três tamanhos. Títulos do Markdown crescem a partir desse tamanho. Tabelas têm bordas finas. Post-its são cartões color.postit com sombra curta e texto em color.inkBlack. Sobre o fundo transparente, a legibilidade depende do wallpaper; o post-it é a opção para texto sempre legível.

## Interação

- O foco inicial de Edição vai para o canvas ou para a primeira ferramenta.
- Tab percorre pegador, ferramentas, histórico e fixar nessa ordem.
- Esc salva e volta à Parede.
- Tooltips mostram nome e atalho depois de um pequeno atraso. Eles não substituem o nome acessível.
- O arraste começa apenas no pegador.
- Um botão nunca move a toolbar.

## Acessibilidade

Todo controle tem nome acessível em pt-BR, foco visível e equivalente de teclado. O estado da ferramenta aparece por ícone, label e tratamento visual.

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
