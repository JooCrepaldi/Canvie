# Produto

O Canvie é um canvas local que fica preso ao desktop do Windows. Ele serve para deixar uma ideia visível e voltar a ela sem abrir um whiteboard.

## A proposta

O app tem um canvas único. O canvas aparece na parede do desktop e fica quieto enquanto o usuário trabalha em outros programas.

Quando o usuário precisa anotar algo, ele usa Ctrl + Alt + T ou o ícone da bandeja. O canvas sobe para a frente, recebe foco e mostra uma toolbar compacta. O usuário desenha ou escreve, depois clica em **Fixar no desktop**. O Canvie salva o documento e devolve o canvas à parede.

Essa troca é o produto. A edição rápida não exige fechar janelas, procurar o app ou reorganizar o desktop.

## Usuário

O primeiro usuário é o próprio criador do Canvie: alguém que passa o dia no Windows e precisa registrar uma ideia enquanto trabalha em outro app.

## Princípios

- **Parede primeiro.** O estado normal do app é o canvas quieto no desktop.
- **Edição sob demanda.** A toolbar e os controles aparecem apenas quando o usuário chama o modo de edição.
- **Um documento.** Um canvas único reduz decisões, memória e tempo de recuperação.
- **Local.** O conteúdo fica na máquina. Não há conta, servidor, sincronização ou telemetria.
- **Poucos controles.** A primeira versão prova a troca entre parede e edição antes de ampliar as ferramentas.
- **Retorno claro.** O botão **Fixar no desktop** sempre deixa visível o que acontecerá com a edição.

## Escopo do primeiro ciclo

O primeiro ciclo entrega:

- um canvas transparente de tamanho definido;
- traços livres com o pincel;
- notas de texto simples;
- borracha;
- desfazer e refazer durante a sessão;
- salvamento local automático;
- o modo **Parede**, com o canvas integrado ao desktop e sem receber cliques;
- o modo **Edição**, com o canvas em primeiro plano, foco e toolbar;
- o botão **Fixar no desktop**, que salva e retorna ao modo Parede;
- Ctrl + Alt + T para chamar ou fechar a edição;
- o tray para chamar a edição, fixar o canvas e sair;
- início com o Windows e instância única.

O texto da primeira versão é texto simples. Markdown, imagens, post-its coloridos, vários canvases e seleção avançada ficam fora deste ciclo.

## Estados visíveis ao usuário

| Estado | O que o usuário vê | O que o app aceita |
| --- | --- | --- |
| Parede | Canvas no desktop, sem toolbar e sem foco | Nenhum clique no canvas. O desktop continua utilizável. |
| Edição | Canvas em primeiro plano, dim leve e toolbar compacta | Desenho, texto, apagar, desfazer, refazer e fixar. |
| Salvando | O mesmo estado de edição, com um aviso discreto na toolbar | A edição continua. O app só conclui a transição depois de salvar. |

O usuário não vê um estado intermediário de janela. Se o salvamento falhar, o canvas permanece em Edição e mostra uma ação para tentar novamente.

## Atalhos

| Entrada | Ação |
| --- | --- |
| Ctrl + Alt + T | Entrar em Edição quando estiver na Parede. Voltar à Parede quando estiver em Edição. |
| Esc | Sair de Edição depois de salvar a alteração atual. |
| B | Selecionar o pincel durante a Edição. |
| T | Criar uma nota de texto durante a Edição. |
| E | Selecionar a borracha durante a Edição. |
| Ctrl + Z | Desfazer a última ação durante a Edição. |
| Ctrl + Shift + Z ou Ctrl + Y | Refazer durante a Edição. |
| Space + arrastar | Mover a câmera durante a Edição. |
| Scroll | Ajustar o zoom durante a Edição. |

Win + T continua reservado pelo Explorer e não é usado pelo produto.

## Critérios de aceite

O primeiro ciclo está pronto quando o usuário consegue:

1. Abrir o Canvie e ver o canvas na posição salva do desktop.
2. Trabalhar em outro aplicativo sem o canvas capturar cliques.
3. Usar Ctrl + Alt + T e encontrar o mesmo canvas em primeiro plano.
4. Desenhar, escrever uma nota, apagar e desfazer.
5. Clicar em **Fixar no desktop** e ver o canvas voltar à parede com a alteração.
6. Fechar o processo, abrir o Canvie e encontrar o último documento salvo.
7. Recuperar a edição pelo tray quando o atalho global não puder ser registrado.
8. Iniciar o Canvie com o Windows sem abrir uma segunda instância.

## Fora do ciclo

Não entram nesta proposta:

- contas, nuvem, colaboração ou sincronização;
- múltiplos canvases ou coleções;
- imagens, clipboard e arrastar arquivos;
- Markdown e editor rico;
- formas, setas, grades e conectores;
- modo de apresentação;
- versões para Linux, macOS ou dispositivos móveis;
- painel permanente de configurações.

Esses itens só entram depois que a troca Parede → Edição → Parede funcionar em uma instalação real.
