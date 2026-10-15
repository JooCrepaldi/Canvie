# Frontend

Frontend is implemented in layers. Paths are relative to frontend/src. L1 delivered the canvas and toolbar, L2 the persistent document, L3 the area and the MVP content, L4 the Wall view, L5 the transition between Fixo and Edição, and L6 the persistence failures in the release log. In 0.0.2, L8 delivered the v2 document, L9 Seleção and the Mão, L10 the right-click menu and L11 the icon toolbar.

## Files

| File | Dono |
| --- | --- |
| App.tsx | Shell transparente, histórico, ferramenta, tinta, tamanho, tema, popover aberto, menu e composição da tela |
| canvas/Canvas.tsx | Área, Canvas 2D dos traços, camada de notas, câmera e interação com elementos |
| canvas/NoteView.tsx e canvas/NoteEditor.tsx | Nota e post-it renderizados e o editor de Markdown |
| canvas/ContextBar.tsx | Barra de alinhamento acima da nota selecionada |
| canvas/camera.ts | Ajustar à tela e zoom por porcentagem |
| canvas/AreaSelector.tsx e canvas/area.ts | Arraste da área, tamanho mínimo e ajuste ao viewport |
| canvas/markdown.ts | markdown-it sem HTML bruto nem imagens |
| canvasTypes.ts | Tipos e limites do documento, paleta de tinta e tamanhos de texto |
| persistence.ts | load, save, saveNow, validação e backup local |
| diagnostics.ts | Ponte para report_frontend_issue, com códigos fixos de falha |
| placement.ts | Ponte Tauri para Wall e Edit |
| Toolbar.tsx e Toolbar.css | Aba de arrastar, ferramentas, popovers do Pincel e do Texto e Fixar no desktop |
| ContextMenu.tsx e ContextMenu.css | Menu do botão direito e diálogo de limpeza |
| preferences.ts | Posição da toolbar, fora do documento |
| index.css e App.css | Transparência, área, notas, dim, foco e escala |

## Documento

CanvasDoc v2, desde a L8, contém revision, area, background, strokes, notes e camera. area é o retângulo em pixels CSS da janela, ou null antes do primeiro arraste. background é `paper`, `white`, `black`, `yellow` ou `transparent`. Cada traço guarda a cor em hexadecimal, a largura e o pincel (`pen` ou `highlighter`, desenhado com 35% de opacidade). Cada nota guarda o Markdown, o tamanho (`xs`, `sm`, `md`, `lg`, `xl` ou `xxl`, de 12 a 48 px em App.css), a fonte (`serif`, `sans` ou `mono`), o alinhamento (`left`, `center` ou `right`) e o tipo (`text` ou `postit`). As listas de valores ficam em canvasTypes.ts e valem para o validador. Desde a L12, a interface oferece todos esses valores: os temas no menu, e as fontes, os tamanhos e os pincéis nos popovers. O estado de janela não entra no documento. O histórico de undo e redo fica em memória.

App.tsx é o único lugar que muda a revisão: cada traço, nota, borracha, pan, zoom, área, fundo, undo e redo recebe a revisão seguinte e vai para o saver. Pan, borracha e edição sem efeito não criam entrada no histórico nem save.

main.tsx cria a persistência e carrega o documento antes do primeiro render. O carregador:

1. lê `canvie.document` do localStorage; se essa chave não existe, lê o documento da 0.0.1 em `canvie.document.v1`;
2. valida a versão, a revisão, cada traço, nota e câmera, os limites e a unicidade dos ids; um v1 válido é migrado em memória para o v2, como descreve a [decisão 0011](../decisions/0011-document-v2-storage.md);
3. retorna um documento vazio quando o payload é inválido ou de uma versão futura;
4. guarda o payload inválido de `canvie.document` em `canvie.document.invalid` e só o substitui na primeira edição; a chave da 0.0.1 nunca é escrita, então ela mesma é a cópia do v1;
5. bloqueia o save da sessão quando não consegue ler o payload ou guardar a cópia, para nunca sobrescrever o que não foi preservado.

Os novos ids são sempre o maior id do documento atual mais um, então continuam além dos ids restaurados.

O saver recebe cada revisão, espera 350 ms sem novas alterações e grava. Antes de gravar, ele valida o documento; depois, relê o valor para confirmar a gravação. Uma falha mantém o último documento válido no localStorage e o documento atual em memória, registra um aviso no console e aparece pelo `hasFailed()`. `flush()` grava o save pendente quando a página fica oculta ou é descartada. saveNow cancela o debounce, grava o documento atual e só resolve depois da confirmação.

Os limites de nota (20 000 caracteres), pontos por traço (50 000), zoom (0,25 a 4) e área mínima (160 × 120) ficam em canvasTypes.ts e valem para o editor e para o validador. Um documento salvo antes da L3, sem area e background, cai no fluxo de documento inválido.

## Área

Sem área no documento, App.tsx mostra o AreaSelector: a tela escurece e o arraste com o botão esquerdo desenha o retângulo. Ao soltar, um retângulo de pelo menos 160 × 120 vira a área e entra no histórico. Um retângulo menor mostra o aviso e espera outro arraste. Redefinir área, no menu do botão direito, abre o mesmo seletor, que Esc cancela quando já existe uma área. Desfazer até antes da primeira área volta ao seletor.

fitArea limita a área à janela na hora de desenhar, sem mudar o documento. Em Edição, a área ganha borda fina e um box-shadow escurece o resto da tela.

## Canvas

Use um canvas DPR-aware do tamanho da área. Converta pontos com screenToWorld e worldToScreen, com a origem do mundo no centro da área. Mantenha o draft do ponteiro em refs para não renderizar React a cada movimento.

Desde a L9, o canvas tem a Seleção, o estado sem ferramenta, e cinco ferramentas que alternam: repetir a ferramenta ativa volta para Seleção ([0010](../decisions/0010-implicit-selection-and-hand.md)):

- Seleção, o padrão de Edição: um clique numa nota a seleciona e arrastar a move; um clique no fundo limpa a seleção. A seleção é estado do App, fora do documento e do histórico; mover, apagar e alinhar entram no histórico. A barra contextual (canvas/ContextBar.tsx) fica acima da nota selecionada, em coordenadas de tela, e alinha o texto;
- Mão: arrastar move só a câmera, inclusive sobre uma nota, porque as notas não recebem ponteiro com a Mão;
- Pincel: traço na tinta selecionada, uma das seis de INK_COLORS. A Caneta desenha com 3 px; o Marca-texto, com 18 px e 35% de opacidade. Escolher uma tinta, a Caneta ou o Marca-texto escolhe o Pincel;
- Texto e Post-it: um clique no fundo abre o editor de uma nova nota, e um clique em uma nota abre a nota;
- Borracha: remove os traços e as notas que o caminho toca.

O botão direito nunca começa um traço, uma borracha ou uma nota, porque ele abre o menu. Um duplo clique no canvas vazio, em Seleção ou com a Mão, abre o editor de uma nota de texto. Uma nota nova, criada por qualquer caminho, devolve o canvas à Seleção com ela selecionada. Space + arrastar move a câmera em qualquer ferramenta.

Os traços ficam no Canvas 2D. As notas são HTML em uma camada com um único transform CSS da câmera, atualizado junto com o redraw; por isso pan e zoom não renderizam React. O Markdown passa pelo markdown-it com `html: false` e sem a regra de imagem ([0007](../decisions/0007-markdown-notes.md)). Um clique em link não navega.

O editor é um textarea com `field-sizing: content`, sem borda, fundo, contorno nem placeholder: só o cursor aparece, na posição e com o padding da nota renderizada, então o texto não salta ao concluir. O post-it mantém o cartão. Ctrl + Enter ou um clique fora conclui, Esc cancela e um texto vazio remove a nota. Duplo clique ou Enter com a nota focada abre o editor. Canvas avisa o App por onEditorChange enquanto um editor está aberto, e o App mostra o popover do texto. Fonte e tamanho são estado do App: abrir uma nota existente copia a fonte e o tamanho dela para o popover, e concluir grava os dois. Os botões de fonte e tamanho não tiram o foco do editor, então a escolha vale para a nota em edição.

Toda mudança atualiza a ref do documento antes de chegar ao App, para que um traço ou nota iniciado pelo mesmo evento receba um id além dela.

## Toolbar

Toolbar, dim, borda da área, menu, seletor de área e avisos só existem quando placement é Edit. Toolbar.tsx segue a [0009](../decisions/0009-toolbar-tab-and-icons.md): [Texto, Post-it, Pincel, Mão] e [Fixar], com ícones do `lucide-react` importados um a um. **Fixar no desktop** fica sempre visível na toolbar; enquanto o save da transição corre, o botão fica desativado e um aviso Salvando… aparece acima da barra, e o canvas continua editável. Sem área, o botão fica desativado e o seletor pede o arraste.

O App escolhe o popover: o do Pincel, com Caneta, Marca-texto, Borracha e tintas, para `brush` e `eraser`; o do texto, com fontes e tamanhos, para `text` e `postit`, ou enquanto um editor de nota está aberto. Esc fecha o popover até a próxima escolha de ferramenta. Depois de cada render, a Toolbar mede o popover: perto de uma lateral, ele desliza para caber na janela; perto do topo, abre abaixo da barra.

Os atalhos H, B, T, P e E trocam de ferramenta apenas em Edit, sem Ctrl, Alt ou Meta e fora de campos de texto.

A aba é o único controle de arraste, com pointer capture, e a posição fica limitada à janela com a aba visível. Arrastar qualquer botão não move a toolbar. Ao soltar, preferences.ts grava `{ left, top }` em `canvie.toolbar` no localStorage, fora do documento e do histórico. Sem preferência, a toolbar fica centralizada, 20 px acima do fim da área de trabalho do monitor (`screen.availTop + screen.availHeight`). Uma preferência inválida ou fora da janela é removida, registra `toolbar_position_reset` por report_frontend_issue e volta ao padrão. Reposicionar toolbar, no menu ou no tray, apaga a preferência. O canvas fica no monitor principal e a toolbar é só horizontal, então monitor e orientação da [0004](../decisions/0004-toolbar-movable-and-persistent.md) não são gravados.

## Movimento e escrita

motion.css guarda os tokens de movimento, as animações e as microinterações; motion.ts guarda o tempo da saída. O shell tem a classe `is-edit` ou `is-wall`, e `is-leaving` durante a saída. Uma animação CSS recomeça quando o nome dela muda, então cada troca de classe toca a entrada, a saída ou o pouso.

requestPin salva primeiro. Só com o save confirmado ele liga `is-leaving`, espera o `animationend` da descida do canvas (`waitForExit`, com limite de 1 s e sem espera com redução de movimento) e chama pin_to_wall. As transições seguem as animações, não um relógio: a janela nunca sai antes do último quadro. O evento Wall desliga `is-leaving`. Um pin que falha também desliga a saída, e o canvas volta ao lugar.

A subida liga `is-entering` só quando Edit vem de Wall com uma área e sem redução de movimento, e o `animationend` dela desliga a classe. Uma área recém-desenhada não sobe: ela fica onde o ponteiro a deixou.

O NoteEditor guarda o texto no próprio estado. O Canvas recebe cada mudança por uma ref, sem renderizar, e lê o texto ao concluir. O foco entra num `useLayoutEffect`, antes do primeiro quadro. O escurecimento (`.area-frame`) tem `will-change: opacity`, que o põe numa camada própria; assim a digitação não repinta a sombra de tela inteira.

## Menu do botão direito

ContextMenu.tsx abre em Edit no ponto do clique, quando o botão direito cai dentro da área, ou no centro da área com Shift + F10 e a tecla de menu. Um listener de `contextmenu` no window impede o menu do WebView em Edit, exceto em campos de texto, que mantêm recortar, copiar e colar.

O menu tem `role="menu"`, foco no primeiro item, setas, Home e End. Tab e Shift + Tab ficam presos no menu e chegam ao campo do zoom. Esc fecha o menu e para a propagação, para não fixar a área. Com o menu ou o diálogo aberto, o listener de teclado do App não age.

- Tema faz commit do background.
- Redefinir área abre o seletor.
- Ajustar à tela usa fitCamera, de canvas/camera.ts, com o tamanho das notas medido no DOM e margem de 32 px. Um canvas vazio volta à câmera padrão.
- Zoom usa zoomCamera, limitado de 0,25 a 4.
- Limpar canvas abre ClearDialog, um `alertdialog` com o foco em Cancelar e o Tab preso aos dois botões. Confirmar remove traços e notas e mantém área, tema e câmera.

Todas essas ações entram no histórico, então Ctrl + Z desfaz cada uma.

## Ponte de estado

placement.ts expõe getPlacement, enterEdit, pinToWall, quitApp, onPlacementChanged, onPinRequested, onCloseRequested e onToolbarReset. No boot:

1. o App assina canvie-placement e chama getPlacement; um evento vence uma resposta mais lenta;
2. em Tauri, o App mostra Wall até o backend confirmar Edit;
3. sem área no documento, o App chama enterEdit uma vez, para a primeira abertura pedir o arraste.

Fixar no desktop, Esc fora do editor e do seletor, e canvie-pin-requested (enviado pelo atalho e pelo tray durante Edit) chamam a mesma função:

1. ignora o pedido se já existe uma transição ou se não há área;
2. tira o foco do elemento ativo, o que conclui uma nota em edição pelo blur;
3. chama saveNow com o documento atual; se falhar, fica em Edit e o aviso de save oferece Tentar novamente;
4. chama pinToWall; se o backend recusar, fica em Edit e mostra O canvas foi salvo, mas não voltou ao desktop, com Tentar novamente.

canvie-close-requested (Alt + F4 ou WM_CLOSE durante Edit) chama a mesma função quando existe área. Antes da primeira área não há o que fixar: o App grava um save que ainda esteja no debounce, como o de desfazer a primeira área, e chama quitApp, que encerra o app. No navegador não existe esse pedido.

O frontend não chama set_always_on_top, set_ignore_cursor_events ou SetParent. Essas operações pertencem ao backend e a wallpaper.rs.

## Fallback de navegador

Sem Tauri, placement.ts usa um adapter em memória que começa em Edit. Fixar no desktop troca a visualização para Wall e Ctrl + Alt + T, capturado pela página, volta para Edit ou pede o pin, como o atalho global. A persistência usa localStorage. O fallback não tenta simular Progman, click-through ou foco real.

## Estados de erro

- documento inválido: canvas vazio e aviso curto com Fechar;
- documento ilegível ou sem cópia possível: aviso persistente de que nada será salvo na sessão;
- save automático falha: aviso Não foi possível salvar com Tentar novamente, que chama saveNow;
- saveNow falha na transição: Edit continua e o aviso de save oferece Tentar novamente;
- pin_to_wall falha depois do save: Edit continua com o aviso de fixar e Tentar novamente;
- evento de colocação atrasado: manter a camada visual anterior até o evento chegar;
- atalho indisponível: não bloquear a toolbar nem o adapter de navegador.

Documento recuperado, salvamento desativado e falha de save também chegam ao log do backend por report_frontend_issue. Só um código fixo atravessa a ponte (`document_recovered`, `saving_blocked` ou `save_failed`), nunca o conteúdo ou o erro do storage, que ficam no console da WebView. Uma sequência de saves falhos conta uma vez, até um save passar. No navegador, o relatório é ignorado.
