# Canvie: PRD do primeiro ciclo

Este documento congela o comportamento que a primeira implementação precisa entregar. O scaffold Tauri e o canvas de edição já existem nas camadas L0 e L1; persistência e integração com o desktop entram nas camadas seguintes.

## 1. Problema

O usuário tem uma ideia enquanto trabalha em outro aplicativo. Abrir um whiteboard, encontrar o documento e voltar ao trabalho demora mais do que a anotação.

## 2. Resultado esperado

O usuário chama o Canvie com um atalho, edita o mesmo canvas em primeiro plano e clica em **Fixar no desktop**. O canvas volta ao desktop com o conteúdo salvo.

## 3. Escopo

O produto tem um canvas único e local. O primeiro ciclo inclui:

- traço livre;
- nota de texto simples;
- borracha;
- undo e redo;
- câmera com pan e zoom;
- persistência local;
- Parede e Edição;
- toolbar compacta, móvel pelo pegador e persistente;
- tray, autostart e instância única.

Imagens, Markdown, múltiplos documentos e formas ficam fora deste PRD.

## 4. Comportamento

### Parede

No boot, o canvas é filho de Progman, transparente e click-through. Ele permanece visível no desktop e não recebe foco ou clique. A toolbar não aparece.

### Edição

Ctrl + Alt + T, o tray ou outra rota de retorno chama Edição. A mesma janela:

1. deixa de ser filha de Progman;
2. vira top-level e fica sempre no topo;
3. recebe foco;
4. mostra a toolbar e o dim leve;
5. libera desenho e texto.

O frontend recebe o evento de estado do backend. Ele não inventa Edição em React.

### Fixar no desktop

O botão **Fixar no desktop**, Esc e Ctrl + Alt + T iniciam a mesma transição:

1. o frontend mostra Salvando;
2. persistence.ts conclui saveNow;
3. se falhar, o app permanece em Edição e mostra Tentar novamente;
4. se passar, o backend reparenta a janela no Progman;
5. o backend reativa click-through e remove always-on-top;
6. o backend emite Parede;
7. o frontend esconde a toolbar.

O app não confirma a troca antes de salvar.

## 5. Atalhos

| Atalho | Ação | Escopo |
| --- | --- | --- |
| Ctrl + Alt + T | Chama ou fixa o canvas | Global |
| Esc | Salva e fixa | Edição |
| B | Pincel | Edição |
| T | Nota de texto | Edição |
| E | Borracha | Edição |
| Ctrl + Z | Desfazer | Edição |
| Ctrl + Shift + Z ou Ctrl + Y | Refazer | Edição |
| Space + arrastar | Pan | Edição |
| Scroll | Zoom | Edição |

O produto não usa Win + T porque o Explorer reserva a combinação.

## 6. Modelo do documento

    CanvasDoc {
      version: 1,
      revision: number,
      strokes: Stroke[],
      notes: Note[],
      camera: Camera
    }

O documento não guarda o estado da janela. Parede e Edição são estado de runtime. A posição da toolbar é uma preferência separada.

## 7. Falhas

| Falha | Resultado |
| --- | --- |
| JSON inválido | Abrir um documento vazio, guardar o payload inválido para diagnóstico e registrar aviso |
| saveNow falha | Permanecer em Edição, preservar o documento em memória e mostrar Tentar novamente |
| atalho ocupado | Iniciar o app, registrar aviso e manter Editar no tray |
| capacidade negada | Iniciar com o recurso afetado desativado e registrar a causa |
| Explorer reinicia | Reparentar no próximo show, enter_edit ou pin_to_wall |
| API Tauri ausente | Usar fallback de navegador para editar e testar o canvas |

## 8. Critérios de aceite

O PRD passa quando uma build instalada demonstra:

1. canvas visível na Parede após o boot;
2. cliques do desktop livres enquanto o Canvie está na Parede;
3. Ctrl + Alt + T trazendo o mesmo documento para Edição;
4. toolbar visível, focável e movível pelo pegador;
5. traço, nota, borracha, undo e redo funcionais;
6. Fixar no desktop salvando antes de reparentar;
7. conteúdo restaurado depois de fechar e abrir;
8. tray, autostart e single-instance funcionais;
9. RAM em repouso e CPU registrados em docs/OPERATIONS.md.
