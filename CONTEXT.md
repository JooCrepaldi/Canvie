# Contexto do Canvie

Este arquivo define os termos do produto. Ele não descreve implementação.

## Canvie

Aplicativo local que mantém uma área de anotação fixa no desktop do Windows e abre uma edição focada quando o usuário chamar.

## Área

O retângulo do desktop escolhido pelo usuário para o canvas. O usuário define a área ao arrastar com o botão esquerdo e pode redefini-la em Edição. A área tem posição e tamanho persistentes.

## Canvas

O único documento visual do Canvie, mostrado dentro da área.

## Tema

A aparência da área atrás do conteúdo: bege, branco, preto, amarelo ou transparente. O primeiro ciclo chamava o tema de fundo e oferecia bege e transparente.

## Fixo

Estado normal do app. A área fica no desktop, abaixo das janelas abertas, sem toolbar e sem receber cliques. No código, este estado se chama Wall.

## Edição

Estado temporário em que a área fica à frente de tudo, recebe foco e mostra a toolbar. O usuário pode desenhar, escrever, colar post-its, apagar, desfazer, refazer, redefinir a área e fixar o documento.

## Fixar no desktop

Ação que salva a alteração atual e devolve a área de Edição para o estado Fixo.

## Nota

Bloco de texto em Markdown colocado no canvas, em uma de três fontes (Serifa, Sem serifa ou Mono) e um de seis tamanhos, de muito pequeno a extra grande.

## Post-it

Nota em Markdown sobre um cartão amarelo.

## Traço

Sequência de pontos criada pelo pincel, com a caneta ou o marca-texto, em uma de seis tintas. A borracha remove traços e notas em uma ação que pode ser desfeita.

## Marca-texto

Pincel largo e translúcido, que deixa ver o que está embaixo. Ele fica abaixo das notas e nunca esconde o texto.

## Seleção

Estado da Edição sem ferramenta pressionada. Em Seleção, o usuário seleciona uma nota ou um post-it para mover, apagar ou alinhar, e um duplo clique no canvas vazio começa uma nota. A seleção não faz parte do documento.

## Mão

Ferramenta que arrasta só a câmera do canvas, sem mover notas.

## Toolbar

Barra compacta de ícones que aparece em Edição. Ela contém as ferramentas Texto, Post-it, Pincel e Mão, e o botão **Fixar no desktop**. As tintas, a Borracha e os tamanhos de texto abrem em popovers acima dela.

## Aba

O pegador da toolbar: uma aba acima da barra, que aparece com o ponteiro ou com o foco e é o único jeito de mover a toolbar. A aba não ativa uma ferramenta.

## Menu do canvas

Menu do botão direito em Edição, com as ações que valem para o canvas inteiro: Reposicionar toolbar, Tema, Redefinir área, Ajustar à tela, Zoom e Limpar canvas.

## Documento

O conteúdo persistido do canvas: área, fundo, traços, notas, post-its, câmera e versão do modelo.

## Limites atuais

- O produto atende apenas Windows.
- O armazenamento é local.
- Existe uma área, um canvas e um documento, no monitor principal.
- Fixo e Edição são os únicos estados de janela.
- O tray e o atalho global são rotas para entrar ou sair de Edição.
