# 0001: manter o MVP local-first e exclusivo para Windows

- **Status:** aceito
- **Data:** 2026-09-25
- **Escopo:** produto e operação

## Contexto

O Canvie precisa provar se um canvas persistente no desktop é útil. Conta, sincronização e colaboração aumentariam a área de produto antes de validar essa tese. O alvo inicial é o desktop do Windows, onde a integração com camadas, tray e autostart é parte do valor.

## Decisão

O MVP salva o conteúdo na máquina, não exige conta e roda apenas no Windows. O app não envia conteúdo ou telemetria para um servidor. A persistência deve sobreviver a fechamento, encerramento do processo e reinício do Windows.

## Consequências

- O modelo de dados pode ser pequeno e versionado localmente.
- O app não precisa de autenticação, backend online ou sincronização de conflito.
- Backup e exportação são responsabilidades da instalação local.
- Linux, macOS e colaboração ficam para uma decisão posterior, depois da validação do produto.

## Alternativas consideradas

- Sincronização desde o primeiro lançamento. Rejeitada porque adiciona conta, rede e conflitos antes de validar o uso.
- Versão multiplataforma desde o início. Rejeitada porque reduz a atenção disponível para a integração do desktop do Windows.
