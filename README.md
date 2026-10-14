# Canvie

Canvie é uma área de anotação fixa no desktop do Windows. Você arrasta um retângulo no desktop e ele vira um canvas para desenhos, notas em Markdown e post-its. Quando precisa anotar algo, use Ctrl + Alt + T: a área vem para a frente com uma toolbar compacta e volta ao desktop, salva, quando você usa o atalho de novo ou clica em **Fixar no desktop**.

A versão 0.0.1 entrega as camadas L0 a L5: a área, o conteúdo, o estado Fixo e a transição para Edição. A L6 e a L7 fecham o primeiro ciclo, e a 0.0.2 segue o [roadmap próprio](docs/ROADMAP-0.0.2.md).

## Proposta atual

- uma área retangular escolhida pelo usuário e um documento;
- fundo bege ou transparente;
- um pincel em preto, azul ou vermelho;
- notas e post-its em Markdown, com três tamanhos de texto;
- Fixo como estado normal e Edição em primeiro plano quando o usuário chama;
- salvamento local;
- tray e instância única;
- Windows como único alvo.

A transição Fixo → Edição → Fixo é o critério principal. As próximas versões estão em [product.md](product.md#próximas-versões).

## Stack escolhida

Use Tauri 2, Rust, WebView2, React 19, Vite, TypeScript estrito e Canvas 2D. A escolha mantém uma única WebView e coloca a integração do Windows no backend.

## Documentação

Leia o documento que responde à pergunta:

| Documento | Conteúdo |
| --- | --- |
| product.md | Proposta, usuário, escopo, atalhos e critérios de aceite |
| architecture.md | Stack, ownership, estados e invariantes |
| design_system.md | Visual inspirado na densidade do Codex e comportamento da toolbar |
| CONTEXT.md | Vocabulário do domínio |
| docs/PRD.md | Contrato funcional do primeiro ciclo |
| docs/MVP-0-ROADMAP.md | Camadas L0 a L7 do primeiro ciclo e evidência de done |
| docs/ROADMAP-0.0.2.md | Camadas L8 a L12 da 0.0.2 |
| docs/ARCHITECTURE.md | Detalhe do runtime e da transição |
| docs/FRONTEND.md | Canvas, persistência, toolbar e fallback de navegador |
| docs/BACKEND.md | Rust, Tauri, tray, atalhos e Win32 |
| docs/OPERATIONS.md | Comandos, E2E, logs e métricas |
| decisions/ | Escolhas difíceis de reverter |

## Desenvolvimento

Para iniciar o frontend:

    Set-Location frontend
    npm install
    npm run tauri dev

Verificações:

    Set-Location frontend
    npm run build
    npx oxlint
    Set-Location src-tauri
    $env:CARGO_BUILD_JOBS = "1"
    cargo check

Consulte docs/OPERATIONS.md antes de testar a integração com o desktop.

## Licença

O Canvie é open source sob a [licença MIT](LICENSE).
