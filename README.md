# Canvie

Canvie é uma área de anotação fixa no desktop do Windows. Você arrasta um retângulo no desktop e ele vira um canvas para desenhos, notas em Markdown e post-its. Quando precisa anotar algo, use Ctrl + Alt + T: a área vem para a frente com uma toolbar compacta e volta ao desktop, salva, quando você usa o atalho de novo ou clica em **Fixar no desktop**.

<img width="1920" height="1080" alt="canvie-0 2" src="https://github.com/user-attachments/assets/48462b68-f299-4022-bea8-d3f1269adf26" />

A versão atual é a 0.2. A 0.0.1 entregou o primeiro ciclo, nas camadas L0 a L7: a área, o conteúdo, o estado Fixo, a transição para Edição e o instalador. A 0.2 entregou as camadas L8 a L13 do [roadmap próprio](docs/ROADMAP-0.2.md): a toolbar de ícones, o menu do botão direito, as fontes, os tamanhos, as tintas, o marca-texto, os temas e o movimento.

## Proposta atual

- uma área retangular escolhida pelo usuário e um documento;
- temas bege, branco, preto, amarelo e transparente;
- um pincel com caneta e marca-texto, em seis tintas;
- notas e post-its em Markdown, em três fontes e seis tamanhos, escritos com um duplo clique;
- toolbar de ícones com aba de arrastar e menu do botão direito;
- Fixo como estado normal e Edição em primeiro plano quando o usuário chama, com uma transição curta;
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
| docs/ROADMAP-0.2.md | Camadas L8 a L13 da 0.2 e o fechamento |
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

## Instalação

A build release gera um instalador NSIS para o usuário atual, sem pedir permissão de administrador:

    Set-Location frontend
    npm run tauri build

O instalador fica em `%LOCALAPPDATA%\canvie-target\release\bundle\nsis\Canvie_<versão>_x64-setup.exe`, fora do repositório. Ele instala o Canvie em `%LOCALAPPDATA%\Canvie` e cria o atalho no menu Iniciar. Para desinstalar, use Configurações > Aplicativos ou o `uninstall.exe` da pasta de instalação. O canvas em `%APPDATA%\com.canvie.app` continua no computador depois da desinstalação.

## Licença

O Canvie é open source sob a [licença MIT](LICENSE).
