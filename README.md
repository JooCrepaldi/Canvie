# Canvie

Canvie é um app para Windows que coloca canvases persistentes no desktop. Cada canvas tem tamanho definido pelo usuário, pode ficar fixo em uma posição e mantém imagens, post-its, desenhos e textos em Markdown.

O primeiro lançamento é pequeno de propósito: um espaço visual que aparece no desktop quando você precisa e não exige uma janela de quadro aberta o tempo todo.

## Visão do produto

O Canvie transforma o desktop em um conjunto de espaços visuais persistentes. Você cria um canvas, escolhe a largura e a altura, define o fundo e coloca o conteúdo onde ele faz sentido para o seu trabalho.

O canvas continua no desktop depois que você fecha a edição e depois que o Windows reinicia. A posição, o tamanho, o conteúdo e as preferências ficam salvos automaticamente.

O app é exclusivo para Windows nesta fase. Não há contas, sincronização ou versão para outro sistema operacional no escopo inicial.

## Termos do produto

| Termo | Significado |
| --- | --- |
| **Canvas** | Um espaço retangular independente, com largura X e altura Y definidas pelo usuário. |
| **Coleção** | O conjunto de canvases criados no app. O usuário pode criar, renomear, ocultar e excluir canvases sem alterar os demais. |
| **Elemento** | Qualquer item colocado em um canvas, como imagem, post-it, traço ou bloco de texto. |
| **Desktop fixo** | O canvas permanece associado ao desktop e à posição escolhida, mesmo quando o usuário troca de aplicativo. |
| **Modo de edição** | Estado em que o canvas recebe seleção, desenho, texto e movimento de elementos. |
| **Modo bloqueado** | Estado em que o conteúdo fica visível, mas não pode ser alterado até o usuário desbloqueá-lo. |
| **Toolbar** | Barra compacta de ferramentas. Ela tem um pegador lateral próprio para ser movida e fixada livremente. |

"Formato" significa as dimensões do canvas. O primeiro recorte usa retângulos com largura X e altura Y. Formas geométricas, como círculos e setas, são elementos dentro do canvas.

## Escopo do primeiro lançamento

### Criar e organizar canvases

- Criar vários canvases independentes.
- Definir a largura e a altura em pixels.
- Escolher uma predefinição de proporção, como 16:9, 4:3 ou quadrado, ou informar valores personalizados.
- Redimensionar um canvas depois de criado.
- Mover um canvas no desktop.
- Renomear, ocultar, duplicar e excluir um canvas.
- Alternar entre canvases pela toolbar ou pela bandeja do Windows.
- Salvar a posição e o tamanho de cada canvas por monitor.

O app trata cada canvas como uma unidade separada. Um canvas pode ser usado para tarefas, outro para referências e outro para anotações pessoais.

### Fixar o canvas no desktop

- Manter o canvas visível na posição escolhida do desktop.
- Deixar o canvas atrás das janelas comuns e da barra de tarefas.
- Manter a posição quando o usuário troca de janela.
- Permitir que o usuário bloqueie o conteúdo para evitar alterações acidentais.
- Permitir que o usuário edite com um atalho global, sem procurar uma janela do app.
- Restaurar canvases no mesmo monitor quando o Windows reiniciar.

O modo fixo controla onde o canvas fica. O modo bloqueado controla se o conteúdo pode ser alterado. Essas duas configurações são independentes.

### Personalizar o fundo

Cada canvas tem as seguintes opções:

- Cor sólida escolhida por seletor ou por valor hexadecimal.
- Transparência total para usar o papel de parede como fundo.
- Opacidade ajustável entre 0% e 100%.
- Pré-visualização em xadrez quando a transparência estiver ativa.
- Cor e opacidade salvas por canvas.

O usuário pode aplicar uma configuração a um canvas ou defini-la como padrão para os próximos canvases.

### Adicionar conteúdo

O canvas aceita estes elementos no primeiro lançamento:

| Elemento | Comportamento |
| --- | --- |
| **Imagem** | Colar da área de transferência ou arrastar um arquivo para o canvas. Redimensionar, mover, girar e excluir. |
| **Post-it** | Criar um bloco curto com cor, tamanho e texto editáveis. Mover e redimensionar livremente. |
| **Pincel** | Desenhar à mão livre com espessura, cor e opacidade ajustáveis. Usar borracha por traço ou por área. |
| **Texto em Markdown** | Escrever títulos, listas, checklists, links, código, negrito e itálico. Alternar entre edição e visualização. |
| **Fonte** | Escolher a fonte, o tamanho, o peso, o alinhamento e a cor de cada bloco de texto. |
| **Seleção** | Selecionar, mover, redimensionar, duplicar e apagar elementos. |

O Markdown é a base dos textos do Canvie. Um post-it pode usar Markdown, e um texto solto pode ser editado como Markdown sem abrir outro editor.

Imagens e desenhos não são convertidos em Markdown. Cada tipo de elemento mantém seus próprios dados e pode ser editado no lugar.

### Toolbar com pegador móvel

A toolbar é compacta e fica visível apenas quando o usuário está editando ou quando a opção de permanência está ativa.

- O pegador fica na lateral da toolbar e tem uma área de toque maior que o ícone.
- Arraste o pegador para mover a toolbar livremente pelo desktop.
- Solte a toolbar em qualquer ponto para fixar a posição.
- Use o comando **Alternar orientação** para deixar a barra horizontal ou vertical.
- O Canvie salva a posição, a orientação e o monitor da toolbar.
- O botão de restaurar volta para a posição padrão sem mover os canvases.
- A toolbar nunca confunde o pegador com uma ferramenta de desenho.

Os botões da toolbar cobrem as ações de selecionar, criar post-it, inserir texto, inserir imagem, desenhar, apagar, desfazer, refazer, trocar canvas e bloquear o canvas ativo.

## Modos de interação

O app tem dois modos para o conteúdo e uma configuração de visibilidade:

### Modo de edição

O canvas ativo recebe cliques e atalhos. Você pode selecionar elementos, escrever, desenhar e mover itens.

### Modo bloqueado

O canvas continua visível no desktop, mas não aceita alterações. A toolbar mostra um indicador de bloqueio. Desbloqueie o canvas pelo atalho global ou pela bandeja do Windows.

### Visibilidade da toolbar

Você pode manter a toolbar visível, ocultá-la após um período sem interação ou mostrar a barra apenas ao usar o atalho global. A ocultação não altera o canvas nem o estado de bloqueio.

## Atalhos padrão

Os atalhos de uma tecla funcionam quando o canvas está em modo de edição e tem foco. Os atalhos globais usam `Ctrl + Alt` para evitar conflitos comuns do Windows.

| Atalho | Ação |
| --- | --- |
| `V` | Selecionar e mover elementos |
| `B` | Usar o pincel |
| `E` | Usar a borracha |
| `T` | Criar ou editar texto em Markdown |
| `N` | Criar um post-it |
| `I` | Inserir uma imagem |
| `H` | Navegar pelo canvas com a mão |
| `Ctrl + Z` | Desfazer |
| `Ctrl + Shift + Z` | Refazer |
| `Delete` | Excluir os elementos selecionados |
| `Ctrl + D` | Duplicar os elementos selecionados |
| `Ctrl + S` | Forçar o salvamento do canvas ativo |
| `Ctrl + Alt + N` | Criar um canvas |
| `Ctrl + Alt + PageDown` | Alternar para o próximo canvas |
| `Ctrl + Alt + PageUp` | Alternar para o canvas anterior |
| `Ctrl + Alt + L` | Bloquear ou desbloquear o canvas ativo |
| `Ctrl + Alt + T` | Mostrar ou ocultar a toolbar |
| `Ctrl + Alt + M` | Alternar a orientação da toolbar |
| `Ctrl + Alt + 0` | Recolocar a toolbar na posição padrão |
| `Ctrl + Alt + ,` | Abrir as configurações |
| `Esc` | Cancelar a ferramenta atual ou fechar o editor de texto |
| `Space + arrastar` | Navegar pelo canvas |
| `Ctrl + Scroll` | Ajustar o zoom do canvas |

Todos os atalhos globais são editáveis. O editor de atalhos mostra conflitos antes de salvar, permite desativar um comando e oferece **Restaurar padrões**. O Canvie não usa `Win + T` como atalho padrão porque o Windows reserva essa combinação.

## Configurações

### Canvas

- Predefinição inicial de largura e altura.
- Predefinições de proporção disponíveis.
- Manter a proporção ao redimensionar o canvas.
- Unidade de medida: pixels ou porcentagem da área de trabalho.
- Limites mínimo e máximo para largura e altura.
- Cor, transparência e opacidade padrão.
- Zoom inicial e comportamento de ajuste à tela.
- Exibir ou ocultar uma grade de alinhamento.
- Ativar ou desativar o encaixe de elementos na grade.
- Confirmar ou não a exclusão de um canvas.

### Desktop e janelas

- Iniciar o Canvie com o Windows.
- Manter o app na bandeja do Windows.
- Mostrar ou ocultar o ícone da bandeja.
- Definir em qual monitor novos canvases aparecem.
- Restaurar canvases no monitor usado por último ou no monitor principal.
- Escolher se o canvas fica atrás das janelas comuns.
- Escolher se o canvas recebe cliques apenas no modo de edição.
- Escolher se a toolbar fica sempre visível, oculta ou aparece por atalho.

### Toolbar

- Posição X e Y da toolbar.
- Monitor da toolbar.
- Orientação horizontal ou vertical.
- Tamanho dos ícones.
- Densidade dos controles.
- Tempo de ocultação automática.
- Exibir nomes e atalhos ao passar o mouse.
- Restaurar posição e aparência padrão.

### Texto e Markdown

- Fonte e tamanho padrão.
- Cor e alinhamento padrão.
- Largura padrão do bloco de texto.
- Renderizar Markdown enquanto o usuário digita ou ao sair da edição.
- Mostrar ou ocultar uma prévia do texto.
- Preservar quebras de linha e espaços em blocos de código.

### Salvamento e arquivos

- Salvar automaticamente após uma alteração.
- Definir o intervalo máximo entre salvamentos.
- Escolher a pasta local dos dados do Canvie.
- Exportar um canvas como imagem.
- Exportar e importar uma coleção para criar uma cópia de segurança.
- Abrir a pasta de dados pelo menu da bandeja.
- Restaurar o último estado salvo após uma falha.

O salvamento é local nesta fase. O app não envia conteúdo para um servidor.

### Acessibilidade

- Aumentar o tamanho da toolbar e dos alvos de clique.
- Usar foco visível em todos os controles.
- Exibir nomes de ferramentas além dos ícones.
- Escolher uma paleta com contraste maior.
- Reduzir animações.
- Navegar pelas ferramentas com o teclado.

## Direção visual

O Canvie usa um visual moderno, minimalista e integrado ao desktop do Windows.

- O canvas e o conteúdo têm prioridade visual.
- A toolbar usa poucos controles, ícones reconhecíveis e estados claros.
- A cor aparece no conteúdo e nas ferramentas que a alteram.
- O fundo do app não cria um painel pesado sobre o desktop.
- Os estados de edição, bloqueio e foco têm diferença visual e textual.
- A interface usa a escala, o contraste e o arredondamento do Windows sem imitar uma janela tradicional.

Evite menus profundos, painéis permanentes e elementos que pareçam um dashboard. A configuração detalhada fica em uma tela separada para não ocupar o canvas.

## Fora do escopo inicial

Estes itens podem entrar depois que a experiência local estiver estável:

- Versões para Linux ou macOS.
- Sincronização entre computadores.
- Colaboração em tempo real.
- Login e contas online.
- Marketplace de templates.
- Canvas infinito sem dimensões definidas.
- Integração com serviços externos.
- Modo de apresentação em tela cheia.

## Critérios de aceite do MVP

O MVP está pronto quando o usuário consegue:

1. Criar dois canvases com dimensões diferentes.
2. Fixar cada canvas em uma posição diferente do desktop.
3. Escolher uma cor, definir transparência e ajustar a opacidade.
4. Inserir uma imagem e um post-it.
5. Desenhar com o pincel e apagar um traço.
6. Criar um texto em Markdown e trocar a fonte.
7. Mover, redimensionar, duplicar e excluir elementos.
8. Mover a toolbar pelo pegador e fixá-la em qualquer lugar.
9. Bloquear um canvas e confirmar que os elementos não mudam por acidente.
10. Fechar e reiniciar o Windows e encontrar a coleção restaurada.
11. Alterar um atalho global e receber aviso se a combinação já estiver em uso.

## Estado do projeto

Conceito e início do MVP para Windows. A documentação define o comportamento do primeiro lançamento e os limites conhecidos. A implementação ainda não está descrita neste repositório.

## Skills do projeto

As skills de trabalho ficam em `.agents/skills/`. Elas cobrem arquitetura, modelagem de domínio, diagnóstico de bugs, implementação, revisão, TDD, TypeScript, documentação, verificação de comportamento, comunicação sem ruído e criação de issues.

Para instalar ou atualizar o Impeccable, que orienta decisões de UI e detecta problemas visuais:

```powershell
npx impeccable install
```

Depois de instalar, use `/impeccable init` no agente para registrar o contexto visual e de produto do Canvie.
