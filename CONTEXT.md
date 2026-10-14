# Contexto do Canvie

Este arquivo define os termos do produto. Ele não descreve implementação.

## Canvie

Aplicativo local que mantém uma área de anotação fixa no desktop do Windows e abre uma edição focada quando o usuário chamar.

## Área

O retângulo do desktop escolhido pelo usuário para o canvas. O usuário define a área ao arrastar com o botão esquerdo e pode redefini-la em Edição. A área tem posição e tamanho persistentes.

## Canvas

O único documento visual do Canvie, mostrado dentro da área.

## Fundo

A aparência da área atrás do conteúdo. O primeiro ciclo oferece bege e transparente.

## Fixo

Estado normal do app. A área fica no desktop, abaixo das janelas abertas, sem toolbar e sem receber cliques. No código, este estado se chama Wall.

## Edição

Estado temporário em que a área fica à frente de tudo, recebe foco e mostra a toolbar. O usuário pode desenhar, escrever, colar post-its, apagar, desfazer, refazer, redefinir a área e fixar o documento.

## Fixar no desktop

Ação que salva a alteração atual e devolve a área de Edição para o estado Fixo.

## Nota

Bloco de texto em Markdown colocado no canvas, com um de três tamanhos: pequeno, médio ou grande.

## Post-it

Nota em Markdown sobre um cartão amarelo.

## Traço

Sequência de pontos criada pelo pincel, em preto, azul ou vermelho. A borracha remove traços e notas em uma ação que pode ser desfeita.

## Seleção

Estado da Edição sem ferramenta pressionada. Em Seleção, o usuário seleciona uma nota ou um post-it para mover, apagar ou alinhar, e um duplo clique no canvas vazio começa uma nota. A seleção não faz parte do documento.

## Mão

Ferramenta que arrasta só a câmera do canvas, sem mover notas.

## Toolbar

Barra compacta que aparece em Edição. Ela contém o pegador, as ferramentas, as cores, os tamanhos de texto, o fundo, a ação Área, o histórico e o botão **Fixar no desktop**.

## Pegador

Controle separado usado para mover a toolbar. O pegador não ativa uma ferramenta.

## Documento

O conteúdo persistido do canvas: área, fundo, traços, notas, post-its, câmera e versão do modelo.

## Limites atuais

- O produto atende apenas Windows.
- O armazenamento é local.
- Existe uma área, um canvas e um documento, no monitor principal.
- Fixo e Edição são os únicos estados de janela.
- O tray e o atalho global são rotas para entrar ou sair de Edição.
