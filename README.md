# MeshBranch

MeshBranch é um site que mostra os modelos 3D de qualquer repositório público do GitHub, direto no navegador. Ele abre arquivos STEP, STL e OBJ. Não precisa instalar nada, nem fazer login.

É grátis e open source (licença MIT).

## Como usar

1. Abra o site.
2. Digite `owner/repo` ou cole a URL do repositório no GitHub.
3. Escolha um arquivo 3D na árvore da esquerda.

Cada tela tem um link próprio, fixo no commit e no arquivo. O botão **Copy link** copia esse link.

Formato do link (o mesmo caminho do GitHub, depois de `#`):

```
#/owner/repo/tree/<branch>/<pasta>
#/owner/repo/blob/<branch>/<arquivo>
```

Também dá para passar qualquer link do GitHub, como no 3dviewer.net:

```
https://patrikguerra.github.io/meshbranch/#ref=https://github.com/owner/repo/blob/<branch>/<arquivo>
```

## Limite do GitHub

Sem login, o GitHub aceita 60 pedidos por hora à sua API, por IP. Abrir um repositório gasta de 1 a 3 pedidos. Baixar os arquivos 3D não gasta pedidos. O contador fica na barra de baixo.

## Rodar no seu computador

Precisa de Node.js 22 ou mais novo.

```
npm install
npm run dev
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes |
| `npm run build` | Gera o site em `dist/` |
| `npm run preview` | Serve o `dist/` em `127.0.0.1` |

## Publicação

O workflow `.github/workflows/pages.yml` publica o site no GitHub Pages a cada push na branch `main`. Ele também pode ser rodado à mão pela aba Actions.

## Pastas

| Pasta ou arquivo | O que tem |
|---|---|
| `src/github/` | Chamadas à API do GitHub, cache e contador do limite |
| `src/importers/` | Leitura de STEP (OpenCascade em WebAssembly, num worker), STL e OBJ |
| `src/viewer/` | Cena 3D com three.js |
| `src/ui/` | Telas e componentes React |
| `PLAN.md` | Plano completo do produto, com fases e riscos |
| `mock/index.html` | Mock navegável das próximas fases, com dados falsos |
