# Canvie

Canvie é um canvas local que fica preso ao desktop do Windows. Quando você precisa anotar algo, use Ctrl + Alt + T. O canvas sobe para a frente, mostra uma toolbar compacta e volta à parede quando você clica em **Fixar no desktop**.

O repositório está no início do projeto. Ele contém a proposta, o contrato de transição, o scaffold Tauri da L0 e o canvas da L1. As camadas seguintes entram depois que cada comportamento tiver evidência própria.

## Proposta atual

- um canvas e um documento;
- Parede como estado normal;
- Edição em primeiro plano quando o usuário chama;
- traços, notas de texto simples, borracha, undo e redo;
- salvamento local;
- tray, autostart e instância única;
- Windows como único alvo.

A transição Parede → Edição → Parede é o critério principal. Imagens, Markdown, múltiplos canvases e formas ficam fora do primeiro ciclo.

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
