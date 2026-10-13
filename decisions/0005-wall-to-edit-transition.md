# 0005: tratar a edição como uma segunda camada da mesma janela

- **Status:** aceito
- **Data:** 2026-10-04
- **Escopo:** produto, janela e ciclo de vida

## Contexto

O Canvie precisa ficar no desktop sem capturar cliques e ainda permitir uma anotação rápida enquanto outro aplicativo está aberto. Uma janela permanente em primeiro plano atrapalha o trabalho. Duas janelas, uma para a parede e outra para edição, duplicam estado e aumentam o uso de memória.

A proposta atual tem um canvas único. O usuário chama a edição, altera o documento e fixa o resultado de volta no desktop.

## Decisão

O app usa uma janela Tauri e dois placements:

- **Wall:** filha de Progman, transparente e click-through;
- **Edit:** top-level, focada, sempre no topo e interativa.

O backend mantém PlacementState como única autoridade. O frontend mostra a toolbar em Edit, chama saveNow antes de pin_to_wall e espelha o evento canvie-placement.

O botão **Fixar no desktop**, Esc, Ctrl + Alt + T e o tray usam a mesma transição Edit → Wall. O backend só reparenta depois que o frontend confirma o salvamento.

## Consequências

- O usuário trabalha no desktop sem uma toolbar permanente.
- A edição e a Parede usam o mesmo documento e a mesma WebView.
- Uma falha de save não esconde a edição nem perde a alteração em memória.
- O caminho de recuperação depende do tray quando o atalho global estiver ocupado.
- A integração exige E2E com parent, foco, click-through, Z-order e logs reais.

## Alternativas

- **Toolbar sempre visível na parede.** Rejeitada porque captura atenção e pode ficar sem clique quando o canvas está click-through.
- **Duas janelas independentes.** Rejeitada porque duplica renderização, estado e persistência.
- **Fechar e abrir uma janela tradicional para editar.** Rejeitada porque quebra a troca rápida e cria uma etapa de localização.
- **Colocar o canvas atrás da camada de ícones.** Rejeitada porque essa camada consome o hit-test e impede a edição.
