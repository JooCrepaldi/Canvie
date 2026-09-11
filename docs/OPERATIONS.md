# Canvie — Operação (build, E2E, máquina, troubleshooting)

> Como rodar, testar, instalar e debugar sem redescobrir tudo. Comandos partem de `frontend/` salvo indicação contrária. Docs-only pode ir direto para main (AGENTS.md §5/§7); mudança de comportamento exige E2E + review.

## 1. Comandos

| O quê | Comando |
| --- | --- |
| Frontend build (tsc + vite) | `npm run build` |
| Lint | `npx oxlint` |
| Rust check | `cargo check` (dentro de `frontend/src-tauri/`) |
| Bundle debug | `npx tauri build --debug` |
| Bundle release | `npx tauri build` |
| E2E real | `powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\<nome>.ps1` (a partir de `frontend/`) |
| PR | `gh pr create --fill` (da feature branch) |
| Merge | `gh pr merge --squash --delete-branch` |

Sempre `CARGO_BUILD_JOBS=1` nesta máquina (5.9GB RAM). Nunca rode cargo com cwd que desvie do `src-tauri/.cargo/config.toml` (target fora do OneDrive).

## 2. Matriz E2E (teclas e janelas reais, nunca mock)

| Script | Cobre | Evidência |
| --- | --- | --- |
| `scripts/e2e/l4-modes.ps1` | `Ctrl+L` lock/unlock, `Ctrl+Alt+T` overlay, `Esc` volta | log stdout com `hotkey\|canvie mode` |
| `scripts/e2e/l5-background.ps1` | Run key, close→tray vivo, 2ª instância sai | `AUTOSTART KEY`, `CLOSE->HIDE OK`, `SINGLE-INSTANCE OK`, linhas `autostart\|tray\|second instance\|hidden to tray` |
| `scripts/e2e/l6-accept.ps1` | Instalado abre < 5s, idle RAM/CPU, overlay TOPMOST on/off via `GetWindowLong`, lock sem crash, close→tray, valor do Run | `OPEN OK`, `IDLE:`, `OVERLAY TOPMOST:`, `OVERLAY EXITED:`, `LOCK TOGGLE NO-CRASH:`, `CLOSE->TRAY:`, `AUTOSTART VALUE:` |
| `scripts/e2e/wallpaper-layers.ps1` | boot parent=Progman, `Ctrl+D` raise, `Ctrl+D` lower, overlay detach, `Esc` back; ordem de irmãos vs DefView | `BOOT/RAISED/LOWERED/OVERLAY/BACK parent=[...]`, log `wallpaper embedded\|canvie layer\|canvie mode\|hotkey registered` |

Manual restante (assumir como não-probado até fazer): feel do desenho à mão, cliques no menu do tray, transparência visual, reboot-com-canvas.

Armadilhas dos scripts: `MainWindowHandle` aponta para o helper `com.canvie.app-sic`, não o canvas — localize `Tauri Window` por PID; após embedar, ele é filho do Progman e some da enumeração top-level (procure nos filhos do Progman primeiro). `SendKeys` exige `WScript.Shell`; PowerShell 5.1 sem `&&` (use `; if ($?) { }`), `$pid` reservado.

## 3. Artefatos e logs

- Instalado: `%LOCALAPPDATA%\Canvie\canvie.exe` (release `Canvie_0.0.1_x64-setup.exe` já validado).
- Log: `%LOCALAPPDATA%\com.canvie.app\logs\Canvie.log` (único rastro em release).
- Target Rust: `%LOCALAPPDATA%\canvie-target` (fora do OneDrive por `src-tauri/.cargo/config.toml`).
- Instaladores vivem no target local, nunca no git.
- Skills locais `.opencode/` são gitignored (instaladas via `npx impeccable install --providers=opencode --scope=project`), nunca commitar.

## 4. Quirks desta máquina (respeitar todos)

- Sync do OneDrive corrompe build concorrente — target fora dele, sempre.
- `rustc` 1.98 crasha intermitente (`STATUS_STACK_BUFFER_OVERRUN`) no crate `windows`: retry o comando exato antes de mudar qualquer coisa.
- Debug instável — valide comportamento em release + log.
- Disco cheio com frequência: limpe `npm cache` quando necessário; prefira release incremental.

## 5. Troubleshooting rápido

| Sintoma | Checar |
| --- | --- |
| `Ctrl+Alt+T` não entra em overlay | log `hotkey registered`; outra app comeu o atalho; `Win+T` nunca vai funcionar (Explorer) |
| Canvas atrás dos ícones não recebe clique | esperado — aperte `Ctrl+D` (raise); ver `canvie layer -> raised` no log |
| Embed falhou, virou overlay fullscreen | log `wallpaper embed failed`; Explorer reiniciou? reabra o app |
| Doc sumiu | `localStorage canvie.canvas.v1` corrompido → boot vazio por desenho (nunca crasha); cheque DevTools/botão `window.__canvie.export` em dev |
| Autostart aponta para dev | apague a chave Run e reinstale pelo setup; E2E `AUTOSTART VALUE` deve mostrar `%LOCALAPPDATA%\Canvie` |
| Build trava/OOM | `CARGO_BUILD_JOBS=1`, feche apps, retry (rustc flake) |

## 6. Fluxo de mudança (resumo)

Branch `feat/<camada>-<slug>` a partir de main → slice vertical pequeno → teste real → self-review do diff → docs na mesma PR se comportamento/atalho/arquitetura mudou → review do assistente (§5b, binário approve/request-changes) → squash merge → tag `mvp-0-*` por milestone. Commits imperativos em inglês (`feat:`/`docs:`/`assets:`/`fix:`) explicando o porquê.
