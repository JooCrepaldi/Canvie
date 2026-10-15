# Roadmap da 0.0.2

A 0.0.2 deixa a anotação mais rápida sem mudar a proposta: continua uma área, um canvas e um documento, no monitor principal. Ela troca a toolbar, cria a seleção, adiciona o menu do botão direito e os valores prontos de texto e pincel. As decisões estão em [0008](../decisions/0008-preset-values.md), [0009](../decisions/0009-toolbar-tab-and-icons.md) e [0010](../decisions/0010-implicit-selection-and-hand.md). As versões seguintes estão em [product.md](../product.md#próximas-versões).

As camadas continuam a numeração do [roadmap do primeiro ciclo](MVP-0-ROADMAP.md). Cada uma fecha um comportamento observável antes da próxima, e a evidência fica em [OPERATIONS.md](OPERATIONS.md).

## Entrada

A 0.0.2 começa quando a 0.0.1 fechar a L6 e a L7 do primeiro ciclo. A tag v0.0.1 marca o código. A L6 e a L7 provam o uso real: Alt + F4, reinício do Explorer, instalação, escala de tela, RAM e CPU.

**Exceção registrada em 2026-10-14:** por decisão do produto, a L8 começou com a L7 provada na build instalada, mas sem as quatro verificações manuais listadas em [OPERATIONS.md](OPERATIONS.md#pendências-manuais-da-l7): reinício do Windows, escala de 125% a 200%, Narrador e alto contraste. Elas continuam pendentes e voltam no fechamento da 0.0.2.

## L8 — Documento v2

**Objetivo:** mudar o formato do documento uma única vez para toda a 0.0.2, sem perder o canvas de quem usa a 0.0.1.

**Inclui:**

- CanvasDoc com `version: 2`;
- nota com `font`: `serif`, `sans` ou `mono`, e `align`: `left`, `center` ou `right`;
- seis tamanhos de nota: `xs`, `sm`, `md`, `lg`, `xl` e `xxl`, com 12, 14, 18, 24, 32 e 48 px;
- traço com `brush`: `pen` ou `highlighter`;
- fundo `paper`, `white`, `black`, `yellow` ou `transparent`;
- migração do v1 na carga: `small` vira `sm`, `medium` vira `md` e `large` vira `lg`, preservando os mesmos pixels; a nota recebe `sans` e `left`, e o traço recebe `pen`;
- uma cópia do payload v1 guardada antes da primeira gravação v2;
- um documento de versão futura continua no fluxo de documento inválido da L2.

A interface não muda nesta camada. A toolbar continua oferecendo os três tamanhos atuais, gravados como `sm`, `md` e `lg`.

A [decisão 0011](../decisions/0011-document-v2-storage.md) define onde o v2 fica: na chave estável `canvie.document`, com a chave da 0.0.1 intocada como a cópia do v1. Ela considera o limite de cerca de 5,24 milhões de caracteres do localStorage, descrito em [OPERATIONS.md](OPERATIONS.md#falhas-conhecidas).

**Falha tratada:** se a migração falhar, o app abre o fluxo de recuperação da L2, com a cópia do payload. Ele nunca grava o v2 por cima do v1 sem uma cópia.

**Done:** um documento salvo pela build v0.0.1 abre na build nova com a mesma área, os mesmos traços, notas, tamanhos e fundo. O primeiro save grava a versão 2, a cópia do v1 fica guardada, e as suítes L2 a L5 continuam passando.

## L9 — Seleção, Mão e duplo clique

**Objetivo:** criar e mexer em notas sem procurar uma ferramenta.

**Inclui:**

- Seleção quando nenhuma ferramenta está ativa; a ferramenta Mover sai;
- clicar seleciona uma nota ou um post-it, com contorno; arrastar move; Delete ou Backspace apaga;
- barra contextual acima do elemento selecionado com alinhar à esquerda, ao centro e à direita;
- duplo clique em área vazia, em Seleção ou com a Mão, cria uma nota de texto e abre o editor;
- volta para Seleção depois de criar uma nota ou um post-it, ao clicar de novo na ferramenta ativa ou ao repetir a letra dela;
- Mão com o atalho H, arrastando só a câmera;
- Esc em três passos: cancela o editor, limpa a seleção e, por fim, salva e fixa;
- atalhos atualizados em product.md, no PRD e em CONTEXT.md.

**Falha tratada:** a seleção não entra no documento nem no histórico. Mover, apagar e alinhar entram no histórico e podem ser desfeitos. Uma nota apagada por engano volta com Ctrl + Z.

**Done:** criar uma nota por duplo clique e digitar; selecionar, mover pela distância exata do ponteiro, centralizar e ver `align: center` salvo; apagar com Delete e recuperar com Ctrl + Z; arrastar com a Mão e ver a câmera mudar sem mover a nota; Esc limpar a seleção e, no segundo toque, fixar.

## L10 — Menu do botão direito

**Objetivo:** levar as ações do canvas para um menu que não ocupa a toolbar.

**Inclui:**

- botão direito dentro da área, só em Edição, ou Shift + F10 e a tecla de menu pelo teclado;
- **Reposicionar toolbar**;
- **Tema**: bege, branco, preto, amarelo e transparente, com o atual marcado;
- **Área**, que redefine o retângulo;
- **Ajustar à tela**, que enquadra todo o conteúdo com margem, dentro da faixa de zoom de 25% a 400%;
- **Zoom**: 50%, 100% e 200%, mais um campo numérico;
- **Limpar canvas**, com confirmação, e que Ctrl + Z desfaz;
- Fundo e Área saem da toolbar atual.

**Falha tratada:** Limpar só grava depois da confirmação. Ajustar à tela num canvas vazio volta à câmera padrão. Um zoom fora da faixa é limitado. No estado Fixo, a área continua sem receber cliques e o menu não abre.

**Done:** abrir o menu pelo mouse e pelo teclado; trocar os cinco temas e ver o fundo salvo; ajustar à tela com conteúdo fora da vista; definir 150% no campo; limpar, cancelar, limpar de novo, confirmar e desfazer.

## L11 — Toolbar nova

**Objetivo:** entregar a toolbar da [0009](../decisions/0009-toolbar-tab-and-icons.md).

**Inclui:**

- aba de arrastar em cima, que aparece só com o ponteiro sobre a toolbar ou com foco nela, grupo [Texto, Post-it, Pincel, Mão] e grupo [Fixar];
- ícones do `lucide-react`, com nome acessível e tooltip com o atalho;
- Fixar com alfinete e destaque, e o aviso de Salvando… e Tentar novamente junto da toolbar;
- popover do Texto com os três tamanhos atuais e popover do Pincel com as três cores atuais e a Borracha;
- posição padrão centralizada no rodapé, acima da taskbar;
- posição salva como preferência, fora do documento; uma posição fora da tela volta ao padrão ao abrir;
- **Reposicionar toolbar** também no tray;
- cores, tamanhos, Desfazer e Refazer saem da barra;
- design_system.md atualizado com a ordem, os estados e a regra nova do botão Fixar.

**Falha tratada:** uma preferência inválida volta à posição padrão e registra um aviso no log. Um clique numa ferramenta nunca move a toolbar.

**Done:** primeira abertura com a toolbar centralizada acima da taskbar; a aba escondida em repouso e visível com o ponteiro na barra e com o foco do Tab; arrastar pela aba e ver a posição restaurada depois de matar e abrir o processo; uma preferência fora da tela voltar ao padrão; Reposicionar pelo menu; a ordem do Tab percorrer aba, ferramentas e Fixar; o aumento do bundle registrado.

## L12 — Valores prontos de texto e pincel

**Objetivo:** entregar as fontes, os tamanhos e as cores da [0008](../decisions/0008-preset-values.md).

**Inclui:**

- popover do Texto com Serifa (Georgia), Sem serifa (Segoe UI Variable) e Mono (Cascadia Mono, com Consolas de reserva);
- seis tamanhos: muito pequeno, pequeno, médio, grande, muito grande e extra grande;
- popover do Pincel com Caneta, Marca-texto e Borracha;
- seis cores de tinta, com pelo menos uma legível sobre cada tema;
- tokens das fontes, dos tamanhos e da paleta em design_system.md.

**Falha tratada:** uma fonte ausente cai na fonte de reserva da mesma família. O marca-texto nunca esconde o texto de uma nota.

**Done:** uma nota em cada fonte e nos seis tamanhos, um traço de marca-texto e um traço em cada cor, salvos e restaurados depois de matar e abrir o processo.

## L13 — Movimento e escrita fluida

**Objetivo:** tirar a fricção da troca entre Fixo e Edição e da escrita, agora que o Canvie é usado no dia a dia. Pedido do criador em 2026-10-14.

**Inclui:**

- **Ctrl + Alt + T para editar:** o canvas aparece com fade e sobe 12 px em 220 ms, o escurecimento entra junto, e a toolbar sobe 60 ms depois;
- **Ctrl + Alt + T, Esc ou Fixar:** depois do save, o canvas desce 12 px com fade em 180 ms, e só então a janela volta ao desktop, onde o canvas pousa com um fade de 160 ms;
- **camadas:** popovers, menu e diálogo abrem com fade e escala de 0,96 para 1; a barra de alinhamento sobe 4 px com fade;
- **microinterações:** botões afundam ao clicar, hover e estado ativo mudam em 120 ms, as amostras de tinta crescem no hover, as notas ganham um halo leve sob o ponteiro em Seleção, e o anel da seleção cresce a partir da nota;
- **notas:** uma nota concluída aparece com fade, e o Markdown cru vira a nota renderizada sem salto; o post-it pousa com uma leve escala;
- **escrita:** o editor guarda o próprio texto, e uma tecla não renderiza o canvas inteiro; o foco entra antes do primeiro quadro, e a primeira tecla não se perde; o escurecimento fica numa camada própria, e a digitação não repinta a tela inteira;
- **traço:** curvas pelos pontos médios das amostras do ponteiro, só no desenho;
- **redução de movimento do Windows:** nenhuma animação, nenhuma transição e nenhuma espera.

**Falha tratada:** Fixar só anima depois de o save passar. Um save que falha mantém a Edição sem animação, e um pin que falha devolve o canvas ao lugar. Durante a saída, o canvas não recebe ponteiro.

**Done:** os nomes, as durações e o atraso das animações conferidos na entrada, na saída, nas camadas e na nota concluída; um Ctrl + Alt + T real sem o canvas do desktop piscar à frente das janelas antes do fade-in, medido pixel a pixel; a saída começando só depois de o save conter o último traço; nenhuma animação com redução de movimento; nenhuma tecla levando 50 ms ou mais para aparecer num canvas com 30 notas, medido também na build anterior; quadros da tela real da entrada em câmera lenta e da saída.

## Fechamento

- A matriz da L7 roda de novo na build instalada da 0.0.2, instalada de fora do pacote do Claude ([OPERATIONS.md](OPERATIONS.md#instalar-fora-de-um-app-empacotado)), e as suítes L2 a L5 continuam passando.
- A versão 0.0.2 entra em package.json, Cargo.toml e tauri.conf.json.
- product.md, o PRD e CONTEXT.md descrevem o comportamento entregue.

## Ordem

    L6 → L7 → L8 → L9 → L10 → L11 → L12 → L13 → fechamento

A L8 vem antes porque todas as camadas seguintes gravam campos novos. A L9 vem antes da toolbar nova porque a Mover sai e a Seleção precisa existir. A L10 vem antes da L11 porque Fundo e Área precisam do menu antes de sair da barra.

## Fora da 0.0.2

Formas, Novo canvas, configurações, alinhamento de canvases, Fixed Canvas e outros monitores estão em [product.md](../product.md#próximas-versões).
