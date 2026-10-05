# Contexto do Canvie

Este arquivo define os termos do produto. Ele não descreve implementação.

## Canvie

Aplicativo local para manter um canvas visível no desktop do Windows e abrir uma edição focada quando o usuário chamar.

## Canvas

O único documento visual do Canvie. Ele tem tamanho, posição e conteúdo persistentes.

## Parede

Estado normal do app. O canvas fica integrado ao desktop, sem toolbar e sem receber cliques.

## Edição

Estado temporário em que o canvas fica em primeiro plano, recebe foco e mostra a toolbar. O usuário pode desenhar, escrever, apagar, desfazer, refazer e fixar o documento.

## Fixar no desktop

Ação que salva a alteração atual e devolve o canvas de Edição para a Parede.

## Nota

Bloco curto de texto simples colocado no canvas. Markdown e edição rica não fazem parte do primeiro ciclo.

## Traço

Sequência de pontos criada pelo pincel. A borracha cria uma ação que remove traços, sem alterar o documento até a ação ser confirmada.

## Toolbar

Barra compacta que aparece em Edição. Ela contém o pegador, as ferramentas do primeiro ciclo, o histórico e o botão **Fixar no desktop**.

## Pegador

Controle separado usado para mover a toolbar. O pegador não ativa uma ferramenta.

## Documento

O conteúdo persistido do canvas: traços, notas, câmera e versão do modelo.

## Limites atuais

- O produto atende apenas Windows.
- O armazenamento é local.
- Existe um canvas e um documento.
- Parede e Edição são os únicos estados de janela.
- O tray e o atalho global são rotas para entrar ou sair de Edição.
