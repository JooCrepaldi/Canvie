# Pesquisa de fontes primárias: instruções de agentes, Tauri 2 e Windows

**Consultado em:** 2026-09-25 (America/Sao_Paulo)  
**Escopo:** fontes primárias para orientar a documentação e as decisões técnicas do Canvie. Os achados abaixo são evidência de documentação, especificação ou código de primeira parte; não substituem as decisões já registradas no README e em `docs/`.

## 1. AGENTS.md e instruções de agentes

### O que a fonte primária confirma

- O Codex reconhece `AGENTS.md` como documentação persistente opcional para orientar o trabalho no repositório. A recomendação prática é registrar objetivo do repositório, convenções de código, testes, contexto relevante, limites e comportamentos específicos. O mesmo guia recomenda manter arquivos menores para facilitar leitura e revisão humana. Fonte: [OpenAI Cookbook: Iterating development workflows with Codex](https://github.com/openai/openai-cookbook/blob/main/examples/codex/iterating-development-workflows-with-codex.md).
- A implementação do Codex define o escopo por árvore de diretórios: o arquivo se aplica à árvore abaixo do diretório que o contém; arquivos mais profundos têm precedência em caso de conflito; instruções diretas do sistema, desenvolvedor e usuário têm precedência sobre `AGENTS.md`. Fonte: [OpenAI Codex: instruções padrão](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/prompts/base_instructions/default.md).
- O código do Codex documenta a descoberta: caminha até a raiz do projeto (por padrão, um marcador `.git`), concatena os `AGENTS.md` encontrados da raiz até o diretório de trabalho e não sobe além da raiz. O nome alternativo local `AGENTS.override.md` também é reconhecido na implementação atual. Fonte: [OpenAI Codex: `agents_md.rs`](https://github.com/openai/codex/blob/main/codex-rs/core/src/agents_md.rs).
- A documentação do GitHub para Copilot separa instruções gerais, instruções específicas por caminho e skills; descreve `AGENTS.md` como regras permanentes compartilháveis entre agentes. Fonte: [GitHub Docs: About GitHub Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review).
- O formato aberto `AGENTS.md` é descrito como um README para agentes: Markdown sem campos obrigatórios, normalmente com visão do projeto, comandos de build/teste, estilo, testes, segurança e operações de PR/deploy. A proposta recomenda arquivos aninhados em monorepos, com o arquivo mais próximo prevalecendo, e trata o conteúdo como documentação viva. Fonte: [AGENTS.md: open format](https://agents.md/) e [repositório do formato](https://github.com/agentsmd/agents.md).
- A documentação atual da OpenAI para modelos Codex confirma que a CLI enumera `AGENTS.md` no diretório de configuração e nos diretórios entre a raiz do repositório e o diretório de trabalho, mesclando instruções por escopo. Fonte: [OpenAI Developers: latest-model guide](https://developers.openai.com/api/docs/guides/latest-model?gallery=open&galleryItem=trivia-quiz-game&model=gpt-5.3-codex&translationFallback=de-DE).

### Limite da evidência

Existe um formato aberto comunitário para o nome e a estrutura básica, mas não há semântica universal de execução. O comportamento de descoberta, precedência, nomes alternativos e carregamento sob demanda é específico do agente (por exemplo, Codex, Copilot ou Claude Code). Portanto, o arquivo do projeto deve declarar seu próprio escopo e precedência e evitar assumir que todos os agentes interpretarão regras extras da mesma forma. `AGENTS.md` é contexto para o agente, não uma barreira de segurança; bloqueios precisam de permissões, hooks ou validações do sistema. Fonte: [Claude Code: memory and instructions](https://code.claude.com/docs/en/memory).

### Aplicação ao Canvie

1. Manter `AGENTS.md` na raiz como contrato do repositório; colocar regras de subárvore apenas quando houver necessidade real.
2. Declarar no próprio arquivo quais documentos são fonte de verdade, quais comandos verificam a mudança e quando a tarefa está concluída, como já faz o Canvie.
3. Manter regras globais curtas, concretas e perenes; mover workflows longos ou específicos para skills/documentos referenciados.
4. Tratar as regras como instruções de trabalho, não como substituto de testes, documentação de produto ou permissões do sistema.
5. Ao adicionar um `AGENTS.md` aninhado, documentar seu escopo e verificar conflitos com o arquivo raiz.

## 2. Tauri 2: arquitetura, ponte e permissões

### Arquitetura frontend/backend

- Tauri combina um processo Rust (core) com frontend HTML/CSS/JavaScript em WebView. O core cria e orquestra janelas, tray e notificações, centraliza IPC e deve manter estado global; o WebView renderiza a interface e usa APIs de mensagem para falar com o core. No Windows, o WebView é fornecido pelo Microsoft Edge WebView2. Fonte: [Tauri: Architecture](https://v2.tauri.app/concept/architecture/) e [Tauri: Process model](https://v2.tauri.app/concept/process-model/).
- A estrutura padrão separa o projeto JavaScript e `src-tauri/` (Cargo, `tauri.conf.json`, `src/lib.rs`, `capabilities/`). A documentação recomenda alterar `lib.rs` para o código da aplicação; `main.rs` apenas inicia a biblioteca no desktop. A pasta `capabilities/` é a localização padrão dos arquivos de capacidade. Fonte: [Tauri: Project structure](https://tauri.app/start/project-structure/).
- Comandos Rust são expostos com `#[tauri::command]`, registrados em `generate_handler!` e invocados do frontend. Comandos podem receber argumentos tipados, retornar dados e usar `Result` para erros; eventos são a alternativa mais dinâmica. Fonte: [Tauri: Calling Rust from the Frontend](https://v2.tauri.app/develop/calling-rust/).

### ACL, capabilities e menor privilégio

- Permissões descrevem privilégios explícitos de comandos; podem habilitar ou negar comandos e definir escopos. Para chegar ao frontend, uma permissão precisa ser referenciada por uma capability. Fonte: [Tauri: Permissions](https://v2.tauri.app/security/permissions/).
- Capabilities vinculam permissões a janelas/WebViews e permitem restringir a exposição do core. Se uma janela pertencer a mais de uma capability, as fronteiras e permissões são combinadas. Arquivos JSON/TOML ficam em `src-tauri/capabilities`; quando `tauri.conf.json` explicita a lista, somente as capabilities listadas entram no build. Fonte: [Tauri: Capabilities](https://v2.tauri.app/security/capabilities/).
- Em tempo de execução, a autoridade do Tauri verifica origem, capability e escopos antes de invocar o comando; se a origem não for autorizada, o comando nem é chamado. Fonte: [Tauri: Runtime authority](https://v2.tauri.app/security/runtime-authority/).

### Plugins diretamente relevantes

- O plugin oficial `global-shortcut` registra atalhos globais em Windows, Linux e macOS. Seus comandos são bloqueados por padrão: a capability precisa conceder individualmente `global-shortcut:allow-register`, `allow-unregister` etc. Fonte: [Tauri: Global shortcut plugin](https://v2.tauri.app/plugin/global-shortcut/).
- O plugin oficial `autostart` oferece `enable`, `disable` e `isEnabled` para iniciar a aplicação no login; as três operações também exigem permissões explícitas na capability. Fonte: [Tauri: Autostart plugin](https://v2.tauri.app/plugin/autostart/).
- O plugin oficial `single-instance` deve ser registrado primeiro e pode focar a janela existente quando outra instância é iniciada. Fonte: [Tauri: Single instance plugin](https://v2.tauri.app/plugin/single-instance/).

### Aplicação ao Canvie

1. Manter desenho de domínio e estado persistente no Rust/core quando houver acesso ao sistema; deixar desenho, interação de canvas e estado efêmero no frontend.
2. Para cada novo comando ou plugin, adicionar o registro no builder e a permissão mínima na capability correspondente; não usar permissões amplas por conveniência.
3. Manter wrappers frontend com fallback quando a API Tauri não existir no navegador de desenvolvimento.
4. Atalhos globais, autostart e single-instance devem continuar no backend/plug-in, com falha registrada e tratamento degradado para não impedir a inicialização.

## 3. Integração Windows: startup, hotkeys, janela, transparência e acessibilidade

### Startup/autostart

- O Windows fornece as chaves `Run` e `RunOnce` por usuário e por máquina. `Run` executa a cada logon; `RunOnce` executa uma vez e é removida. A linha de comando tem limite documentado de 260 caracteres, a ordem entre múltiplos valores não é garantida e o sistema pode atrasar a execução para reduzir impacto no logon. `RunOnce` é indicada para condições transitórias, não para recriação contínua. Fonte: [Microsoft Learn: Run and RunOnce Registry Keys](https://learn.microsoft.com/en-us/windows/win32/setupapi/run-and-runonce-registry-keys).
- O plugin autostart do Tauri abstrai o mecanismo de autostart do sistema para a aplicação e expõe o estado de habilitação. Fonte: [Tauri: Autostart plugin](https://v2.tauri.app/plugin/autostart/).

**Decisão para o Canvie:** o valor de autostart deve apontar para o executável instalado, com caminho corretamente citado; nunca registrar binário de desenvolvimento. A ativação/desativação deve ser idempotente e ficar sob controle do usuário.

### Hotkeys

- `RegisterHotKey` define um atalho de sistema e entrega `WM_HOTKEY` à janela ou fila da thread associada. A chamada falha quando a combinação já está registrada, quando a janela pertence a outra thread ou quando o identificador está fora do intervalo permitido; `F12` é reservado para depuração. Fonte: [Microsoft Learn: RegisterHotKey](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey).
- O plugin Tauri `global-shortcut` encapsula registro, callbacks de pressionar/soltar e permissões específicas. Fonte: [Tauri: Global shortcut plugin](https://v2.tauri.app/plugin/global-shortcut/).

**Decisão para o Canvie:** falha de registro deve ser aviso e modo degradado, não erro fatal. Combinações usadas pelo shell ou já ocupadas precisam de alternativa documentada; teclas sem modificadores devem permanecer locais ao frontend para não capturar digitação de outros aplicativos.

### Janela, layering e transparência

- Uma janela filha (`WS_CHILD`) precisa de uma janela pai e fica confinada à área cliente do pai. Janelas layered (`WS_EX_LAYERED`) podem usar alpha ou color key; desde Windows 8 o estilo é suportado também em janelas filhas. Fonte: [Microsoft Learn: Window Features](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features) e [SetLayeredWindowAttributes](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setlayeredwindowattributes).
- `SetLayeredWindowAttributes` usa `bAlpha=0` para transparência total e `255` para opacidade total. Depois de chamar essa API, chamadas posteriores a `UpdateLayeredWindow` falham até limpar e reativar o bit de estilo layered. Fonte: [Microsoft Learn: SetLayeredWindowAttributes](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setlayeredwindowattributes).
- No hit-testing de uma janela layered, pixels alpha zero ou color-keyed deixam passar mensagens de mouse; com `WS_EX_TRANSPARENT`, os eventos passam para as janelas abaixo. Para janelas top-level, a orientação do DWM é combinar `WS_EX_TRANSPARENT` com `WS_EX_LAYERED`. Fonte: [Microsoft Learn: Window Features](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features) e [DWM performance best practices](https://learn.microsoft.com/en-us/windows/win32/dwm/bestpractices-ovw).
- O DWM compõe e efetivamente duplica o buffer das janelas; a documentação recomenda não desenhar diretamente na superfície primária nem ler/escrever em display DC. Fonte: [Microsoft Learn: DWM performance best practices](https://learn.microsoft.com/en-us/windows/win32/dwm/bestpractices-ovw).

**Decisão para o Canvie:** toda mudança de parent/style/layering deve ser concentrada no módulo Win32/backend e seguida de revalidação da relação pai-filho, estilo e ordem Z. O canvas deve continuar transparente no HTML e na janela Tauri; click-through deve ser implementado no backend, preservando uma rota de retorno por tray/atalho.

### Acessibilidade e teclado

- A Microsoft recomenda que todos os elementos tenham nome, rótulo e valores expostos programaticamente; controles customizados precisam de trabalho adicional para UI Automation. Mudanças de estado/aparência devem gerar eventos acessíveis. Fonte: [Microsoft Learn: Accessibility best practices](https://learn.microsoft.com/en-us/windows/win32/winauto/accessibility-best-practices).
- A aplicação deve respeitar configurações do sistema, suportar alto contraste e escalas DPI, oferecer navegação por teclado com ordem lógica e foco visível, e não comunicar estado apenas por cor. Fonte: [Microsoft Learn: Accessibility best practices](https://learn.microsoft.com/en-us/windows/win32/winauto/accessibility-best-practices).
- UI Automation fornece acesso programático à maioria dos elementos, permitindo leitores de tela, tecnologias assistivas e scripts de teste. Fonte: [Microsoft Learn: UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32).

**Aplicação ao Canvie:** a toolbar precisa de nomes/descrições acessíveis, foco e equivalentes de teclado para cada ação; tooltips visuais não podem ser o único canal. A tela deve reagir a DPI e configurações de contraste sem sobrescrever preferências do Windows.

## 4. Registro de consulta

Todos os links acima foram abertos/consultados em **2026-09-25**. As páginas Tauri e Microsoft podem atualizar conteúdo sem alterar a URL; quando a página informa uma data de atualização, ela permanece indicada na própria fonte.

