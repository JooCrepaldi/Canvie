# Canvie

Canvie é uma área de anotação fixa no desktop do Windows. Você arrasta um retângulo no desktop e ele vira um canvas para desenhos, notas em Markdown e post-its. Quando precisa anotar algo, use Ctrl + Alt + T: a área vem para a frente com uma toolbar compacta e volta ao desktop, salva, quando você usa o atalho de novo ou clica em **Fixar no desktop**.

O repositório está no início do projeto. Ele contém a proposta, o contrato de transição, o scaffold Tauri da L0, o canvas da L1 e o documento persistente da L2. As camadas seguintes entram depois que cada comportamento tiver evidência própria.

## Proposta atual

- uma área retangular escolhida pelo usuário e um documento;
- fundo bege ou transparente;
- um pincel em preto, azul ou vermelho;
- notas e post-its em Markdown, com três tamanhos de texto;
- Fixo como estado normal e Edição em primeiro plano quando o usuário chama;
- salvamento local;
- tray e instância única;
- Windows como único alvo.

A transição Fixo → Edição → Fixo é o critério principal. Voz para texto, imagens no Markdown, múltiplos canvases e formas ficam para depois do MVP.

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
| docs/MVP-0-ROADMAP.md | Camadas L0 a L6 e evidência de done |
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
