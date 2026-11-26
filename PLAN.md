# MeshBranch: plano do visualizador 3D para repositórios GitHub

> Nome do produto: **MeshBranch**. O repositório do projeto será público e terá o mesmo nome (`meshbranch`).

## 1. O que é

O MeshBranch é um site estático e open source. Ele mostra arquivos 3D direto de um repositório GitHub, sem instalar nada e sem servidor próprio. A V1 abre STEP/STP, STL e OBJ. A V1.1 soma 3MF, glTF/GLB e PLY (seção 8). O **three.js** desenha tudo e lê os formatos de triângulos. O STEP é lido pelo occt-import-js (OpenCascade no navegador).

A pessoa abre o repositório no MeshBranch e vê:

- a árvore de arquivos da branch, com os modelos 3D em destaque;
- o modelo em 3D, com a árvore de peças, e pode ligar ou desligar cada peça;
- as outras branches, com um aviso quando uma delas tem versões mais novas dos arquivos 3D.

O site é publicado no **GitHub Pages**. Tudo roda no navegador: as chamadas à API do GitHub, o download dos arquivos e a leitura dos modelos.

O mock navegável está em `c:\projeto\Visualizador3d\mock\index.html` (seção 10).

## 2. Problema e público

| Quem | Dor hoje |
|---|---|
| Quem faz hardware e impressão 3D em Git | O GitHub mostra STL, mas não mostra STEP nem separa peças. Não dá para ligar e desligar peças. |
| Revisores de PR de mecânica | Precisam baixar o arquivo e abrir em outro programa para ver uma mudança. |
| Times com várias branches de design | Não sabem qual branch tem a versão mais nova de uma peça. |

Proposta de valor: **"o navegador de modelos 3D do seu repositório"**. É só colar a URL do repositório.

## 3. Requisitos

### Funcionais

| ID | Requisito |
|---|---|
| R1 | Abrir qualquer repositório público por URL (`github.com/owner/repo`) ou por `owner/repo`, numa caixa de busca da página inicial. |
| R2 | Mostrar a árvore de arquivos da branch, com filtro "só 3D", filtro por tipo (um botão por formato) e busca por nome. |
| R3 | V1: abrir `.step`/`.stp`, `.stl` e `.obj`. V1.1: `.3mf`, `.gltf`/`.glb` e `.ply`. |
| R4 | Mostrar a árvore de peças do modelo. Cada nó pode ser mostrado ou escondido. Um grupo liga ou desliga todos os filhos. Há "Mostrar tudo", "Esconder tudo" e "Isolar" (duplo clique). |
| R5 | Clicar numa peça no 3D seleciona a peça na árvore, e o contrário também. |
| R6 | Trocar de branch pelo seletor, mantendo o arquivo aberto quando ele existe na outra branch. |
| R7 | Avisar quando outra branch tem arquivos 3D mais novos que a branch atual. O aviso aparece num banner, num ponto no seletor de branch, num ponto ao lado do arquivo na árvore e no painel do arquivo aberto. |
| R8 | Comparar branches: listar os arquivos 3D novos ou alterados na outra branch, com botão para abrir cada um lá. |
| R9 | Link direto (deep link) para repo + branch + arquivo, que pode ser copiado e compartilhado. |
| R10 | Propriedades do arquivo: formato, tamanho, número de peças, triângulos, dimensões (mm) e último commit. |
| R11 | Vistas da câmera (ajustar, iso, topo, frente, direita), arestas, wireframe e grade. |
| R12 | V1 sem token: só repositórios públicos, dentro do limite de 60 requisições por hora (seção 6.2). Token e repositórios privados ficam para depois (seção 7). |
| R13 | Tema claro e escuro. Interface só em en-US na V1. Os textos ficam num arquivo `en-US.json`, para traduzir depois. |
| R14 | Ao abrir um repositório, nenhum arquivo abre sozinho. O centro mostra "Select a 3D file" e a lista dos modelos do repositório. |
| R15 | Na V1, o seletor mostra só branches. Tags ficam para depois. |
| R16 | Cada peça (ou grupo) pode trocar de cor, de transparência (0 a 90%; para sumir com a peça, usa-se o olho) e de modo de vista: sólido, sólido com arestas ou wireframe. Num grupo, a mudança vale para todos os filhos. O painel da peça sempre mostra o modo que está na tela. Edges e Wireframe da barra de cima valem para o modelo todo e desfazem a escolha por peça. "Reset" volta ao que veio no arquivo. As mudanças não alteram o arquivo e somem ao trocar de arquivo. |

### Fora do escopo

IGES e BREP ficam de fora. O `occt-import-js` já lê os dois, então entrar depois custa pouco.

### Não funcionais

- **Sem backend.** Só arquivos estáticos no GitHub Pages.
- **Privacidade:** os arquivos nunca saem do navegador, exceto para `github.com`.
- **Desempenho:** a leitura dos arquivos roda num Web Worker, então a tela não trava. O usuário vê o progresso e pode cancelar.
- **Memória:** não há limite fixo de tamanho. Acima de um valor configurável (padrão 50 MB), o app avisa antes de abrir.
- **Cache:** cada arquivo é guardado pelo SHA do blob no IndexedDB. O mesmo conteúdo nunca é baixado duas vezes, mesmo em outra branch.
- **Acessibilidade:** navegação por teclado nas duas árvores, rótulos ARIA, foco visível e respeito a `prefers-reduced-motion`.
- **Licença e preço:** grátis, licença MIT.

## 4. Soluções que já existem

Pesquisa feita antes de planejar o código.

| Projeto | Licença | O que faz | Como entra no MeshBranch |
|---|---|---|---|
| [three.js](https://threejs.org) | MIT | Renderização WebGL, com leitores de STL, OBJ, 3MF, glTF e PLY. | **Base de tudo:** desenho e leitura dos formatos de triângulos. |
| [occt-import-js](https://github.com/kovacsv/occt-import-js) | LGPL-2.1 | OpenCascade em WebAssembly. Lê STEP no navegador e devolve triângulos e a árvore da montagem em JSON. | **Leitor do STEP.** O three.js não lê STEP, porque o STEP guarda formas exatas, não triângulos. Carregado como módulo separado, o que respeita a LGPL. |
| [Online3DViewer](https://github.com/kovacsv/Online3DViewer) (3dviewer.net) | MIT | Visualizador web de muitos formatos, com árvore de peças. Não lê repositórios GitHub nem branches. | Referência de UX e de como montar a árvore de peças. |
| Visualizador de STL do próprio GitHub | — | Mostra só STL, sem peças e sem branches. | Concorrente direto. O MeshBranch cobre o que ele não faz. |

**Conclusão:** nenhuma ferramenta junta "repositório GitHub + branches + árvore de peças". O MeshBranch monta a interface com three.js e usa o occt-import-js só para o STEP.

## 5. Arquitetura

```
Navegador (GitHub Pages, só arquivos estáticos)
│
├── UI React ──────────────► estado (repo, branch, arquivo, visibilidade)
│
├── GitHub client ─────────► api.github.com (REST)
│        │                   raw.githubusercontent.com (conteúdo público)
│        └── cache IndexedDB (ETag por URL, blob por SHA)
│
├── Worker de importação ──► occt-import-js (STEP) / loaders do three.js (STL, OBJ; V1.1: 3MF, glTF, PLY)
│        └── devolve: malhas (buffers transferíveis) + árvore de peças
│
└── Viewer three.js ───────► cena, câmera, seleção, visibilidade
```

| Módulo | Função |
|---|---|
| `github/` | Cliente da API: branches, árvore, conteúdo, commits, compare. Cuida do ETag e do limite de requisições. |
| `importers/` | Um importador por formato. Todos devolvem o mesmo `ModelNode` (nome, filhos, malhas, cor). |
| `worker/` | Roda os importadores fora da thread da tela. |
| `viewer/` | Monta a cena three.js a partir do `ModelNode`. Cuida de câmera, seleção, visibilidade e modos de exibição. |
| `branches/` | Calcula o que é "mais novo" em cada branch (seção 6.3). |
| `ui/` | Telas e componentes (seção 10). |

## 6. Integração com o GitHub

### 6.1 Chamadas usadas

| Para quê | Chamada |
|---|---|
| Dados do repo (branch padrão) | `GET /repos/{owner}/{repo}` |
| Listar branches | `GET /repos/{owner}/{repo}/branches?per_page=100` |
| Árvore de arquivos | `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` |
| Conteúdo | `https://raw.githubusercontent.com/{owner}/{repo}/{sha}/{path}` |
| Último commit do arquivo | `GET /repos/{owner}/{repo}/commits?sha={branch}&path={path}&per_page=1` |
| Diferença entre branches | `GET /repos/{owner}/{repo}/compare/{atual}...{outra}` |

Cuidados:

- **Árvore truncada:** se a resposta vier com `truncated: true` (repos enormes), o app busca pasta por pasta, só quando a pasta é aberta.
- **Git LFS:** muitos repositórios de modelos usam LFS. O app detecta o ponteiro (`version https://git-lfs.github.com/spec/v1`) e baixa de `media.githubusercontent.com`. **Precisa testar se esse endereço aceita CORS.** Se não aceitar, o app mostra "arquivo LFS" com link para baixar.
- **Arquivos ligados:** OBJ pode citar um `.mtl`, e glTF pode citar `.bin` e texturas. O app busca esses arquivos na mesma pasta, pelo mesmo SHA.
- **Links fixos por SHA:** o conteúdo é baixado pelo SHA do commit, não pelo nome da branch. Assim, um push no meio da leitura não mistura versões.

### 6.2 Limite de requisições (V1 sem token)

A V1 não usa token. A API do GitHub permite **60 requisições por hora, por IP**. O GraphQL não funciona sem token, então a V1 só usa REST.

O que gasta e o que não gasta:

| Ação | Custo na API |
|---|---|
| Baixar o arquivo 3D (`raw.githubusercontent.com`) | 0. Não conta no limite da API. |
| Abrir o repositório (`/repos`) | 1 |
| Listar branches (`/branches`, até 100) | 1 |
| Árvore da branch (`/git/trees?recursive=1`) | 1 por branch aberta |
| Último commit do arquivo (`/commits?path=`) | 1 por arquivo, só quando o arquivo é aberto |
| Ver se uma branch tem arquivos mais novos (`/compare`) | 1 por branch comparada |
| Resposta `304` (nada mudou, via ETag) | **1.** Testado em 2026-11-26: sem token, o `304` também gasta. |

Orçamento de uma sessão típica:

| Momento | Requisições |
|---|---|
| Abrir repo + branches + árvore | 3 |
| Comparar até 10 branches | até 10 |
| Abrir 5 arquivos (último commit) | 5 |
| Trocar de branch 2 vezes | 2 |
| **Total** | **cerca de 20 de 60** |

Regras para não estourar:

1. **Ordem de prioridade.** Árvore e arquivos vêm primeiro. Comparação de branches e último commit vêm depois e são os primeiros a parar.
2. **Reserva.** Abaixo de 10 requisições restantes, o app para as comparações e o último commit. Ele mantém só o que é preciso para navegar.
3. **Comparação limitada.** Compara no máximo 10 branches, as primeiras da lista. A comparação roda uma vez por sessão e depois só quando o usuário pede ("Refresh").
4. **Cache local primeiro.** Como o `304` também gasta, o app responde do cache antes de perguntar ao GitHub. A árvore é guardada pelo SHA e nunca é pedida de novo, porque não muda. O SHA de uma branch fica guardado por 2 minutos, e a branch padrão por 1 dia. Um push novo aparece em até 2 minutos.
5. **Contador visível.** A barra de status lê `X-RateLimit-Remaining` e `X-RateLimit-Reset` e mostra "57 / 60 · resets 10:42".
6. **Limite atingido.** O app avisa em um banner com o horário da liberação. Arquivos já em cache continuam abrindo. Os downloads pelo `raw` continuam funcionando, se a árvore estiver em cache.

Cada troca de branch compara de novo, agora a partir da nova branch (até 10 pedidos). Pares de commits já comparados vêm do cache e não gastam nada. Branches que ficaram de fora têm um botão "Check" no seletor (1 pedido cada).

O limite é por IP. Em rede compartilhada (empresa, faculdade), outras pessoas podem gastar o mesmo limite.

Saída futura sem backend: uma GitHub Action opcional no repositório do usuário gera `.meshbranch/index.json` a cada push (branches, árvores, arquivos mais novos e últimos commits). O MeshBranch baixa esse arquivo pelo `raw`, que custa 0. Com ele, o repo não gasta nada do limite.

### 6.3 Como saber que "outra branch tem arquivos mais novos"

Definição: um arquivo 3D é **mais novo na branch B** quando foi criado ou alterado em B **depois do ponto em que B se separou da branch atual**.

Passos (V1, sem token):

1. Usar a lista de branches que já foi buscada. Ela traz o SHA de cada branch, sem data.
2. Pular as branches com o mesmo SHA da atual, e as já comparadas com o mesmo par de SHAs (cache).
3. Para até 10 branches, chamar `compare/{atual}...{B}`. Se `ahead_by` for 0, a branch não tem nada novo. Senão, guardar os arquivos com status `added`, `modified` ou `renamed` e extensão 3D.
4. Mostrar o resultado no banner (a branch com mais arquivos), no seletor (um selo "N newer" por branch), na árvore (um ponto laranja) e no painel do arquivo.
5. Refazer a conta só quando o usuário clica em "Refresh" ou troca de branch. A troca reaproveita o cache quando o par de SHAs é o mesmo.

Essa definição é melhor que só comparar datas. Ela ignora arquivos que B herdou e não mexeu. O `compare` lista no máximo 300 arquivos; acima disso o selo mostra "300+".

O mock usa datas fixas para simular o resultado.

## 7. Login e repositórios privados

| Modo | Como funciona |
|---|---|
| Público (**V1**) | Sem login e sem token. Só repositórios públicos. |
| Token pessoal (depois da V1) | O usuário cria um *fine-grained token* só leitura (`Contents: Read`, `Metadata: Read`), só nos repositórios que quiser. O token fica em `sessionStorage` por padrão. A opção "lembrar neste navegador" usa `localStorage`. O conteúdo passa a vir de `GET /repos/{owner}/{repo}/contents/{path}?ref={sha}` com `Accept: application/vnd.github.raw+json`. |
| GitHub App + OAuth (futuro) | O GitHub não permite trocar o código OAuth por token direto do navegador (falta CORS). Isso pede um proxy mínimo, por exemplo um Cloudflare Worker. Fica fora da V1 para manter "zero backend". |

Risco do token: um token salvo no navegador pode vazar por XSS. Mitigação: CSP rígida, nenhum HTML vindo de fora é renderizado, token só leitura e com escopo mínimo.

## 8. Visualização

| Formato | Versão | Leitor | Árvore de peças |
|---|---|---|---|
| STEP / STP | V1 | `occt-import-js` no worker | Hierarquia da montagem, com nomes e cores do arquivo. |
| STL | V1 | `STLLoader` (binário e ASCII) | Um corpo só. Mostra 1 item. |
| OBJ | V1 | `OBJLoader` (+ `MTLLoader`) | Um item por `o` / `g`. Lê o `.mtl` se ele estiver na mesma pasta. |
| 3MF | V1.1 | `3MFLoader` | Um item por objeto, com cores. Muito usado por Bambu Studio e PrusaSlicer. |
| glTF / GLB | V1.1 | `GLTFLoader` | Hierarquia de nós, com nomes e materiais. |
| PLY | V1.1 | `PLYLoader` | Um corpo só. Pode trazer cor por vértice (scanners). |

O STEP é o formato com a árvore de peças mais rica na V1. STL tem 1 corpo, e OBJ só tem grupos de um nível.

Funções do visualizador:

- Câmera orbital, com vistas Ajustar, Iso, Topo, Frente e Direita. Tecla `F` ajusta.
- View cube no canto superior direito ([three-viewport-gizmo](https://github.com/Fennec-hub/three-viewport-gizmo), MIT): gira junto com a câmera, e um clique numa face, aresta ou canto leva a uma das 26 vistas.
- Arestas (`EdgesGeometry`), wireframe e grade no chão do modelo.
- Seleção com destaque. Duplo clique isola a peça.
- Por peça: cor, transparência e modo de vista (sólido, sólido com arestas, wireframe). Ficam no painel de propriedades da peça selecionada (R16).
- Unidade em mm. STEP e 3MF trazem a unidade. STL, OBJ e PLY não trazem, então o app assume mm e deixa trocar. glTF usa metros, então o app converte.
- Futuro: medir distâncias, plano de corte, vista explodida e **comparação visual entre branches** (as duas versões sobrepostas, com cores diferentes).

## 9. Endereços e navegação

O link usa o mesmo caminho do GitHub, depois de `#`. Ele sempre mostra o arquivo ou a pasta aberta.

| GitHub | MeshBranch |
|---|---|
| `github.com/owner/repo` | `.../meshbranch/#/owner/repo` (branch padrão) |
| `github.com/owner/repo/tree/feature/x` | `.../meshbranch/#/owner/repo/tree/feature/x` |
| `github.com/owner/repo/tree/feature/x/cad` | `.../meshbranch/#/owner/repo/tree/feature/x/cad` |
| `github.com/owner/repo/blob/feature/x/cad/case.step` | `.../meshbranch/#/owner/repo/blob/feature/x/cad/case.step` |

Caminho reverso: ao abrir um link, o app separa a branch do caminho do arquivo.

1. Se o resto tem um só pedaço (`tree/main`), ele é a branch. Custa 0 pedidos extras.
2. Se começa com um SHA de 40 caracteres, o SHA é a referência. Custa 0 pedidos extras.
3. Senão, o app busca a lista de branches (1 pedido a cada 100 branches, guardada por 2 minutos). Ele escolhe a branch **mais longa** que bate com o começo do caminho, como o GitHub faz. Exemplo: em `feature/x/cad/case.step`, a branch `feature/x` vence a branch `feature`.
4. Se nenhuma branch bate, o primeiro pedaço vira a referência (pode ser tag ou SHA curto).

Depois disso, a árvore abre até o arquivo ou a pasta. Uma pasta mostra a lista dos modelos dentro dela. Navegar dentro da mesma branch não gasta pedidos.

- Colar na página inicial um link do GitHub (repo, branch, pasta ou arquivo) abre o mesmo lugar no MeshBranch.
- `#ref=<link do GitHub>` também abre o lugar do link, como o `#model=` do 3dviewer.net. Aceita links `github.com/.../tree/`, `/blob/`, `/raw/` e `raw.githubusercontent.com`. `#model=` e `#url=` também funcionam. Depois de lido, o endereço vira o formato normal.
- O formato antigo `#/owner/repo?ref=<branch>&path=<arquivo>` ainda funciona e é trocado pelo novo.
- Tags ficam para depois.
- Botão "Copy link" copia o endereço atual.
- Futuro: guardar no link também a câmera e as peças escondidas.

## 10. Interface e design

Objetivo: parecer um produto profissional, no nível de ferramentas como Linear, Vercel e Onshape. Nada de template genérico.

Princípios:

- **Neutro e denso:** cinzas frios, uma cor de destaque (verde-azulado) e laranja só para "tem algo mais novo".
- **O modelo é o centro:** painéis laterais estreitos e sem bordas pesadas, e um fundo do 3D com gradiente suave.
- **Tipografia:** Inter para texto. JetBrains Mono para branches, caminhos e números.
- **Selos de tipo** (STP, STL, OBJ, 3MF, GLB, PLY) com cor própria. Na árvore, eles mostram o tipo de arquivo antes do nome.
- **Estados claros:** carregando (com o passo atual), vazio, erro, arquivo LFS, arquivo grande demais.

Layout:

| Área | Conteúdo |
|---|---|
| Barra superior | Logo, repositório, seletor de branch (com ponto laranja), tema, "Copy link", requisições restantes |
| Banner | "Branch X tem N arquivos 3D mais novos", com "Compare" e "Switch" |
| Esquerda | Árvore de arquivos, busca, filtros. Recolhe numa barra fina para dar espaço ao 3D. |
| Centro | Caminho do arquivo, barra de vistas e o 3D |
| Direita | Árvore de peças com busca (olho para ligar e desligar), propriedades recolhíveis, aviso de versão mais nova, último commit |
| Barra de status | Requisições restantes, cache, peças e triângulos visíveis |

### Mock

Arquivo: `c:\projeto\Visualizador3d\mock\index.html`. Abra direto no navegador. Precisa de internet para baixar o three.js do unpkg.

O mock usa dados falsos do repositório `orange-pi-zero3-case`, com 4 branches. A montagem e a placa são `.step`. As outras peças são `.stl` e `.obj`. O que dá para testar:

- trocar de branch e ver a árvore e o modelo mudarem (a branch `feature/antenna-holder` tem o suporte da antena);
- banner, selos no seletor, pontos na árvore e aviso no painel de propriedades;
- "Compare", com a lista de arquivos e o botão "Open";
- ligar e desligar peças, isolar com duplo clique, clicar no 3D para selecionar;
- filtros, busca, vistas, arestas, wireframe, grade, tema claro e escuro;
- link direto (`#/...?ref=...&path=...`).

As peças são caixas e cilindros. No produto real, elas vêm do arquivo.

## 11. Pilha técnica

| Item | Escolha | Motivo |
|---|---|---|
| Build | Vite + TypeScript | Rápido e gera site estático. |
| UI | React | Pilha que o autor já usa. |
| 3D | three.js + `OrbitControls` + loaders do `three/addons` | Padrão de mercado, MIT. |
| STEP | occt-import-js no Web Worker | Único leitor de STEP maduro no navegador. |
| Estado | React (context + reducer) | Pouco estado, sem biblioteca extra. |
| Cache | IndexedDB (`idb-keyval`) | API mínima. |
| Estilo | CSS com variáveis (como no mock) | Tema claro e escuro sem framework. |
| Textos | Um arquivo `en-US.json` | Só en-US na V1, sem biblioteca. Pronto para traduzir depois. |
| Testes | Vitest (lógica) + Playwright (fluxo principal) | Cobre `branches/` e `importers/` com arquivos de exemplo. |
| Deploy | GitHub Actions + `actions/deploy-pages` | Publica a cada push na branch principal. |

Alternativa avaliada: usar o `EmbeddedViewer` do Online3DViewer inteiro. Foi descartada porque prende a interface dele e dificulta a árvore de peças própria. Usar three.js e occt-import-js direto custa pouco código a mais e dá controle total.

## 12. Estrutura de pastas

```
meshbranch/
├── index.html
├── src/
│   ├── main.tsx
│   ├── app/            # rotas por hash, layout
│   ├── github/         # client, cache, rate limit
│   ├── branches/       # cálculo de "mais novo"
│   ├── importers/      # step.ts, stl.ts, obj.ts; V1.1: threemf.ts, gltf.ts, ply.ts → ModelNode
│   ├── worker/         # import.worker.ts
│   ├── viewer/         # cena, câmera, seleção
│   ├── ui/             # FileTree, ModelTree, BranchMenu, Banner, Props
│   ├── i18n/           # en-US.json
│   └── styles/
├── tests/
│   ├── fixtures/       # assembly.step, part.stl, part-ascii.stl, fan.obj + fan.mtl
│   └── e2e/
├── .github/workflows/  # ci.yml, pages.yml
├── LICENSE
└── README.md
```

## 13. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| F0 | Plano e mock | Este documento e `mock/index.html` (feito). |
| F1 | MVP público (feito) | Colar URL de repo público, ver a árvore e abrir STEP, STL e OBJ. Publicado no Pages. |
| F2 | Peças (feito) | Árvore de peças com olho, isolar, seleção nos dois sentidos, propriedades. Cor, transparência e modo de vista por peça (R16). O link direto já saiu na F1. |
| F3 | Branches (feito) | Seletor, troca mantendo o arquivo, cálculo de "mais novo", banner e "Compare". |
| F4 | Cache e limite (feito) | Arquivos 3D guardados no navegador pelo SHA do blob (IndexedDB), sem baixar de novo, nem em outra branch. Aviso no topo quando o limite de pedidos acaba, com a hora da liberação. O contador já saiu na F1. |
| F4.1 | Git LFS | Abrir arquivos guardados no Git LFS, baixando de `media.githubusercontent.com`. Se o endereço não aceitar CORS, fica o aviso com link para baixar. |
| F5 | Acabamento de produto | Tema, acessibilidade, estados vazios e de erro, página inicial com exemplos. Fecha a **V1**. |
| V1.1 | Mais formatos | Abrir 3MF, glTF/GLB e PLY, com árvore de peças, filtros e testes com arquivos de exemplo. |
| F6 | Extras | Traduções (pt-BR primeiro), tags no seletor, token e repos privados, `.meshbranch/index.json` gerado por Action, medir, corte, vista explodida, comparação visual entre branches, botão "Open in MeshBranch" para READMEs. |

## 14. Riscos e decisões abertas

| Item | Situação |
|---|---|
| CORS do `media.githubusercontent.com` (LFS) | Testar na F4.1. Se falhar, mostrar link para baixar. |
| STEP ou arquivo muito grande pesa na memória | Worker com cancelamento e aviso acima de 50 MB, configurável. |
| 60 requisições por hora, por IP (V1 sem token) | Orçamento e regras da seção 6.2. Redes compartilhadas podem esgotar o limite. |
| `304` conta no limite sem token | Confirmado na F1. O cache local responde antes (seção 6.2, regra 4). |
| Token no navegador (depois da V1) | Escopo mínimo, `sessionStorage` por padrão, CSP rígida. |
| Nome do produto | MeshBranch: livre no npm e sem repos com esse nome no GitHub (checado em 2026-11-26). Falta checar domínio e marca. |
| Repositório do projeto | Público, com o nome do produto. Criar depois da escolha do nome. |
