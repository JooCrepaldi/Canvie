# Design system

O Canvie usa uma interface pequena, escura e calma, próxima da linguagem visual do Codex e do ChatGPT para desktop. A interface aparece para editar e desaparece quando o canvas volta à parede.

## Direção

O conteúdo ocupa o centro. A toolbar é uma faixa estreita, com poucos grupos e rótulos claros. O app não usa navegação lateral, dashboard ou painel permanente.

O visual do Codex inspira hierarquia, espaçamento, foco e estados de ferramenta. O Canvie não copia telas, ícones ou marcas do ChatGPT.

## Estados

| Estado | Tratamento visual | Regra |
| --- | --- | --- |
| Parede | Canvas transparente, sem chrome de edição | Não mostrar toolbar nem dim. |
| Edição | Dim leve no desktop e toolbar flutuante | Mostrar foco, ferramenta ativa e ação de fixar. |
| Salvando | Mesmo layout, label curto Salvando… | Não bloquear o canvas. |
| Erro de salvamento | Mensagem curta e ação Tentar novamente | Manter Edição até uma gravação passar. |

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

Use a fonte e a escala do Windows. Respeite alto contraste e redução de movimento.

## Toolbar

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

    [pegador] [cursor] [pincel] [texto] [borracha] [desfazer] [refazer] [Fixar no desktop]

O botão de fixar usa texto, não apenas um ícone. A ação é a saída principal da Edição.

## Canvas

Na Parede, não desenhe uma moldura ou painel atrás do conteúdo. Em Edição, use uma borda fina e um dim de baixa opacidade para marcar a área ativa sem cobrir os traços.

Notas usam uma superfície discreta e texto legível. O canvas não usa cartões coloridos nem efeitos de papel no primeiro ciclo.

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
