# 0010: seleção implícita, Mão só para a câmera e duplo clique para escrever

- **Status:** aceito
- **Data:** 2026-10-13
- **Escopo:** interação e frontend

## Contexto

Na 0.0.1, a ferramenta Mover arrasta uma nota quando o clique começa nela e move a câmera quando começa no fundo. A toolbar da [0009](0009-toolbar-tab-and-icons.md) não tem Mover nem um botão de seleção. O criador do produto decidiu que a Mão só move a câmera, que uma nota começa com duplo clique no canvas e que uma nota selecionada mostra o alinhamento.

## Decisão

- Quando nenhuma ferramenta está ativa, o canvas fica em **Seleção**. A Seleção não tem botão.
- Em Seleção, um clique seleciona uma nota ou um post-it. Arrastar move o elemento. Delete ou Backspace apaga. Uma barra contextual acima do elemento oferece alinhar à esquerda, ao centro e à direita.
- Duplo clique em área vazia, em Seleção ou com a Mão, cria uma nota de texto no ponto e abre o editor. Duplo clique numa nota abre a edição. Com o Pincel ou a Borracha, o duplo clique continua desenhando ou apagando.
- Depois de criar uma nota ou um post-it, o canvas volta para Seleção. Clicar de novo na ferramenta ativa, ou repetir a letra dela, também volta.
- A Mão, com atalho H, arrasta só a câmera. Space + arrastar continua movendo a câmera em qualquer ferramenta.
- Esc cancela o editor aberto. Sem editor, Esc limpa a seleção. Sem editor e sem seleção, Esc salva e fixa.
- Na 0.0.2, a seleção vale para um elemento. Seleção múltipla e traços selecionáveis entram com as formas na 0.0.3.

## Consequências

- A seleção é estado de interação do frontend. Ela não entra no documento nem no histórico. Mover, apagar e alinhar entram no histórico.
- A tabela de atalhos em [product.md](../product.md) e no [PRD](../docs/PRD.md) muda quando a L9 da [0.0.2](../docs/ROADMAP-0.0.2.md) for entregue.
- Com um elemento selecionado, fixar pelo Esc pede dois toques. O atalho global e o botão Fixar continuam fixando com um toque.
- O botão Texto vira a configuração da próxima nota, e não o único jeito de criá-la.

## Alternativas consideradas

- **Mão que também arrasta notas, como o Mover.** Rejeitada pelo criador para separar navegar de editar.
- **Botão de Seleção na toolbar.** Rejeitada porque acrescenta um botão para o estado padrão.
- **Criar texto só pelo botão Texto.** Rejeitada porque o duplo clique é o caminho mais curto até a escrita.
- **Apagar só com Ctrl + Z.** Rejeitada porque o histórico vale apenas na sessão: um traço de outro dia não sairia sem limpar o canvas inteiro. A Borracha continua no popover do Pincel.
