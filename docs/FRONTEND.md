# Frontend

Frontend is implemented in layers. Paths are relative to frontend/src. L1 delivered the canvas and toolbar and L2 delivered the persistent document; placement remains a later layer.

## Files

| File | Dono |
| --- | --- |
| App.tsx | Shell transparente e composição da tela |
| Canvas.tsx | Canvas 2D, notas, câmera, ferramentas e histórico |
| canvasTypes.ts | Tipos de documento, traço, nota, câmera e ferramenta |
| persistence.ts | load, save, saveNow, validação e backup local |
| placement.ts | Ponte Tauri para Wall e Edit |
| Toolbar.tsx | Pegador, ferramentas, histórico e Fixar no desktop |
| index.css e App.css | Transparência, dim, toolbar, foco e escala |

## Documento

CanvasDoc v1 contém revision, strokes, notes e camera. O estado de janela não entra no documento. O histórico de undo e redo fica em memória.

App.tsx é o único lugar que muda a revisão: cada traço, nota, borracha, pan, zoom, undo e redo recebe a revisão seguinte e vai para o saver. Pan e borracha sem efeito não criam entrada no histórico nem save.

main.tsx cria a persistência e carrega o documento antes do primeiro render. O carregador:

1. lê `canvie.document.v1` do localStorage;
2. valida a versão, a revisão, cada traço, nota e câmera, os limites e a unicidade dos ids;
3. retorna um documento vazio quando o payload é inválido;
4. guarda o payload inválido em `canvie.document.invalid.v1` e só o substitui na primeira edição;
5. bloqueia o save da sessão quando não consegue ler o payload ou guardar a cópia, para nunca sobrescrever o que não foi preservado.

Os novos ids são sempre o maior id do documento atual mais um, então continuam além dos ids restaurados.

O saver recebe cada revisão, espera 350 ms sem novas alterações e grava. Antes de gravar, ele valida o documento; depois, relê o valor para confirmar a gravação. Uma falha mantém o último documento válido no localStorage e o documento atual em memória, registra um aviso no console e aparece pelo `hasFailed()`. `flush()` grava o save pendente quando a página fica oculta ou é descartada. saveNow cancela o debounce, grava o documento atual e só resolve depois da confirmação.

Os limites de nota (2000 caracteres), pontos por traço (50 000) e zoom (0,25 a 4) ficam em canvasTypes.ts e valem para o editor e para o validador.

## Canvas

Use um canvas DPR-aware. Converta pontos com screenToWorld e worldToScreen. Mantenha o draft do ponteiro em refs para não renderizar React a cada movimento.

O ciclo inicial tem quatro ferramentas:

- cursor para seleção de ações e pan;
- pincel;
- texto simples;
- borracha.

O cursor não escreve. A borracha cria uma ação de histórico que pode ser desfeita.

## Toolbar

Toolbar só renderiza quando placement é Edit. Ela chama placement.ts ao executar Fixar no desktop. Enquanto saveNow está pendente, desative apenas a ação de fixar e mostre Salvando.

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
