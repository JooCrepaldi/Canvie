# Frontend

Frontend is implemented in layers. Paths are relative to frontend/src. L1 delivered the canvas and toolbar, L2 the persistent document, and L3 the area and the MVP content; placement remains a later layer.

## Files

| File | Dono |
| --- | --- |
| App.tsx | Shell transparente, histórico, ferramenta, tinta, tamanho, fundo e composição da tela |
| canvas/Canvas.tsx | Área, Canvas 2D dos traços, camada de notas, câmera e interação com elementos |
| canvas/NoteView.tsx e canvas/NoteEditor.tsx | Nota e post-it renderizados e o editor de Markdown |
| canvas/AreaSelector.tsx e canvas/area.ts | Arraste da área, tamanho mínimo e ajuste ao viewport |
| canvas/markdown.ts | markdown-it sem HTML bruto nem imagens |
| canvasTypes.ts | Tipos e limites do documento, paleta de tinta e tamanhos de texto |
| persistence.ts | load, save, saveNow, validação e backup local |
| placement.ts | Ponte Tauri para Wall e Edit |
| Toolbar.tsx | Pegador, ferramentas, cores, tamanhos, fundo, área, histórico e Fixar no desktop |
| index.css e App.css | Transparência, área, notas, dim, toolbar, foco e escala |

## Documento

CanvasDoc v1 contém revision, area, background, strokes, notes e camera. area é o retângulo em pixels CSS da janela, ou null antes do primeiro arraste. background é `paper` ou `transparent`. Cada traço guarda a cor em hexadecimal; cada nota guarda o Markdown, o tamanho (`small`, `medium` ou `large`) e o tipo (`text` ou `postit`). O estado de janela não entra no documento. O histórico de undo e redo fica em memória.

App.tsx é o único lugar que muda a revisão: cada traço, nota, borracha, pan, zoom, área, fundo, undo e redo recebe a revisão seguinte e vai para o saver. Pan, borracha e edição sem efeito não criam entrada no histórico nem save.

main.tsx cria a persistência e carrega o documento antes do primeiro render. O carregador:

1. lê `canvie.document.v1` do localStorage;
2. valida a versão, a revisão, cada traço, nota e câmera, os limites e a unicidade dos ids;
3. retorna um documento vazio quando o payload é inválido;
4. guarda o payload inválido em `canvie.document.invalid.v1` e só o substitui na primeira edição;
5. bloqueia o save da sessão quando não consegue ler o payload ou guardar a cópia, para nunca sobrescrever o que não foi preservado.

Os novos ids são sempre o maior id do documento atual mais um, então continuam além dos ids restaurados.

O saver recebe cada revisão, espera 350 ms sem novas alterações e grava. Antes de gravar, ele valida o documento; depois, relê o valor para confirmar a gravação. Uma falha mantém o último documento válido no localStorage e o documento atual em memória, registra um aviso no console e aparece pelo `hasFailed()`. `flush()` grava o save pendente quando a página fica oculta ou é descartada. saveNow cancela o debounce, grava o documento atual e só resolve depois da confirmação.

Os limites de nota (20 000 caracteres), pontos por traço (50 000), zoom (0,25 a 4) e área mínima (160 × 120) ficam em canvasTypes.ts e valem para o editor e para o validador. Um documento salvo antes da L3, sem area e background, cai no fluxo de documento inválido.

## Área

Sem área no documento, App.tsx mostra o AreaSelector: a tela escurece e o arraste com o botão esquerdo desenha o retângulo. Ao soltar, um retângulo de pelo menos 160 × 120 vira a área e entra no histórico. Um retângulo menor mostra o aviso e espera outro arraste. A ação Área abre o mesmo seletor, que Esc cancela quando já existe uma área. Desfazer até antes da primeira área volta ao seletor.

fitArea limita a área à janela na hora de desenhar, sem mudar o documento. Em Edição, a área ganha borda fina e um box-shadow escurece o resto da tela.

## Canvas

Use um canvas DPR-aware do tamanho da área. Converta pontos com screenToWorld e worldToScreen, com a origem do mundo no centro da área. Mantenha o draft do ponteiro em refs para não renderizar React a cada movimento.

O ciclo tem cinco ferramentas:

- Mover: pan quando o arraste começa no fundo, e arrasta a nota quando começa nela;
- Pincel: traço na tinta selecionada (preto, azul ou vermelho);
- Nota e Post-it: um clique no fundo abre o editor de uma nova nota, e um clique em uma nota abre a nota;
- Borracha: remove os traços e as notas que o caminho toca.

Os traços ficam no Canvas 2D. As notas são HTML em uma camada com um único transform CSS da câmera, atualizado junto com o redraw; por isso pan e zoom não renderizam React. O Markdown passa pelo markdown-it com `html: false` e sem a regra de imagem ([0007](../decisions/0007-markdown-notes.md)). Um clique em link não navega.

O editor é um textarea com `field-sizing: content`. Ctrl + Enter ou um clique fora conclui, Esc cancela e um texto vazio remove a nota. Duplo clique ou Enter com a nota focada abre o editor. Os botões de tamanho não tiram o foco do editor, então o tamanho escolhido vale para a nota em edição.

Toda mudança atualiza a ref do documento antes de chegar ao App, para que um traço ou nota iniciado pelo mesmo evento receba um id além dela.

## Toolbar

Toolbar só renderiza quando placement é Edit. Ela chama placement.ts ao executar Fixar no desktop. Enquanto saveNow está pendente, desative apenas a ação de fixar e mostre Salvando. Até a L5, a janela comum mostra a toolbar sempre.

Os atalhos B, T, P e E trocam de ferramenta apenas sem Ctrl, Alt ou Meta e fora de campos de texto.

O pegador tem um ponteiro separado. Arrastar qualquer botão não move a toolbar. A posição é normalizada pelo monitor e salva em uma preferência independente do documento.

## Ponte de estado

No boot:

1. chame getPlacement;
2. assine onPlacementChanged;
3. renderize Wall até o evento confirmar Edit;
4. carregue o documento em paralelo.

O frontend não chama set_always_on_top, set_ignore_cursor_events ou SetParent. Essas operações pertencem a wallpaper.rs.

## Fallback de navegador

Sem Tauri, placement.ts usa um adapter em memória. O botão Fixar no desktop troca a visualização entre Wall e Edit no navegador. A persistência usa localStorage. O fallback não tenta simular Progman, click-through ou foco real.

## Estados de erro

- documento inválido: canvas vazio e aviso curto com Fechar;
- documento ilegível ou sem cópia possível: aviso persistente de que nada será salvo na sessão;
- save automático falha: aviso Não foi possível salvar com Tentar novamente, que chama saveNow;
- saveNow falha: toolbar em Edit com Tentar novamente;
- evento de colocação atrasado: manter a camada visual anterior e mostrar uma mensagem de sincronização;
- atalho indisponível: não bloquear a toolbar nem o adapter de navegador.
