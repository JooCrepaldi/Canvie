# Frontend

Frontend is implemented in layers. Paths are relative to frontend/src. L1 currently owns the in-memory canvas and toolbar; persistence and placement remain later layers.

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

O carregador deve:

1. ler o payload do localStorage;
2. validar a versão e os campos;
3. retornar um documento vazio quando o payload estiver inválido;
4. guardar o texto inválido para diagnóstico local;
5. reseed ids além do maior id lido.

O saver recebe alterações, espera 350 ms e grava um snapshot. saveNow cancela o debounce, grava o snapshot atual e só resolve quando o valor foi confirmado no adapter.

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

- documento inválido: canvas vazio e aviso curto;
- saveNow falha: toolbar em Edit com Tentar novamente;
- evento de colocação atrasado: manter a camada visual anterior e mostrar uma mensagem de sincronização;
- atalho indisponível: não bloquear a toolbar nem o adapter de navegador.
