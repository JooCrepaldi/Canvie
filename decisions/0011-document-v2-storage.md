# 0011: guardar o documento v2 numa chave estável e manter o v1 como cópia

- **Status:** aceito
- **Data:** 2026-10-14
- **Escopo:** frontend, persistência e dados do usuário

## Contexto

A tag v0.0.1 distribuiu o documento v1 na chave `canvie.document.v1` do localStorage do WebView2. A L8 da [0.2](../docs/ROADMAP-0.2.md) muda o formato uma única vez: notas ganham fonte, alinhamento e seis tamanhos, traços ganham o tipo de pincel, e o fundo aceita cinco valores. A [0008](0008-preset-values.md) exige migrar o v1 sem perder o canvas, e o roadmap pede uma cópia do v1 antes da primeira gravação v2.

O localStorage aceita cerca de 5,24 milhões de caracteres por origem, somando todas as chaves (ver [OPERATIONS.md](../docs/OPERATIONS.md#falhas-conhecidas)).

## Decisão

- O documento de qualquer versão fica na chave `canvie.document`. A versão vive dentro do JSON, e não no nome da chave.
- A chave `canvie.document.v1` nunca é escrita nem apagada pela 0.2. Quando `canvie.document` ainda não existe, o carregador lê o v1 dessa chave e o migra em memória. A primeira gravação escreve `canvie.document`, e a chave antiga fica como a cópia do v1.
- A migração mantém ids, posições, cores, larguras, pontos, textos, área, fundo, câmera e revisão. Os tamanhos `small`, `medium` e `large` viram `sm`, `md` e `lg`, com os mesmos 14, 18 e 24 px. Notas recebem `sans` e `left`, e traços recebem `pen`. Campos que o v1 não tinha são descartados.
- Um payload inválido em `canvie.document` é copiado para `canvie.document.invalid`, como na L2. Um v1 inválido sozinho abre um canvas vazio com o aviso de recuperação, e a própria chave antiga é a cópia.
- Uma versão futura continua no fluxo de documento inválido.
- As cores dos fundos branco, preto e amarelo valem só para renderizar documentos v2 até a L10, que as registra no design system junto com o menu de Tema.

## Consequências

- Quem usava a 0.0.1 guarda o documento duas vezes depois da primeira edição. Num documento muito grande, isso reduz pela metade o espaço livre do localStorage. Remover a cópia v1 exige uma decisão futura.
- Se a 0.0.1 for aberta de novo, ela lê `canvie.document.v1` e mostra o canvas de antes da migração, sem as edições feitas na 0.2. O que ela gravar fica nessa chave antiga, e a 0.2 continua lendo `canvie.document`, então essas edições não aparecem ao voltar para a 0.2.
- As próximas migrações não precisam de chave nova: o carregador lê `version` e migra no mesmo lugar.
- A cópia de payload inválido da 0.0.1, em `canvie.document.invalid.v1`, fica onde está e não é mais lida.
- Os E2E usam as chaves novas, e a L8 prova a migração com um documento gravado por uma build anterior à L8.

## Alternativas consideradas

- **Gravar o v2 na própria chave `canvie.document.v1`, com uma cópia em outra chave.** Rejeitada porque o nome da chave mentiria sobre o conteúdo e a 0.0.1 trataria o v2 como inválido.
- **Uma chave por versão (`canvie.document.v2`).** Rejeitada porque cada migração futura criaria uma chave nova e outra cópia.
- **Migrar sem cópia.** Rejeitada porque um defeito na migração apagaria o único documento do usuário.
- **Apagar o v1 depois da primeira gravação v2.** Rejeitada por enquanto: um defeito que perdesse uma nota só apareceria depois, quando a cópia já não existisse.
