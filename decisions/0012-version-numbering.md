# 0012: numerar as versões pelo tamanho do salto

- **Status:** aceito
- **Data:** 2026-10-15
- **Escopo:** produto e distribuição

## Contexto

A primeira versão saiu como 0.0.1, com a tag v0.0.1: a área, o conteúdo, o estado Fixo, a transição para Edição e o instalador. O plano seguinte foi chamado de 0.0.2, e o depois dele de 0.0.3. A 0.0.2 terminou com seis camadas (L8 a L13): toolbar nova, menu do botão direito, seleção e Mão, fontes, tamanhos, tintas, marca-texto, temas e movimento. O criador do produto avaliou que esse salto pede um número maior que um patch.

## Decisão

- A versão entregue no fim da L13 é a **0.2.0**, com a tag v0.2.0 e o nome "Canvie 0.2".
- As versões planejadas seguem a mesma escala: a antiga 0.0.3, com vários canvases e formas, passa a ser a **0.3**. A 1.0 continua 1.0.
- A 0.0.1 mantém o número, porque já foi distribuída.
- O terceiro número fica para correções dentro de uma versão: 0.2.1, 0.2.2.
- Os documentos usam 0.2 e 0.3. O roadmap da versão passa a se chamar [ROADMAP-0.2.md](../docs/ROADMAP-0.2.md).

## Consequências

- package.json, Cargo.toml e tauri.conf.json passam a 0.2.0, e o instalador se chama `Canvie_0.2.0_x64-setup.exe`.
- O documento continua no formato v2. A versão do app e a do documento são números independentes.
- Registros antigos, como logs, evidências e os PRs #13 a #20, citam "0.0.2". Eles falam da mesma versão.

## Alternativas consideradas

- **Manter 0.0.2.** Rejeitada pelo criador, porque o número subestima o que mudou para quem usa.
- **Pular para 1.0.** Rejeitada porque a 1.0 já tem um escopo planejado: organizar o desktop com vários canvases.
