# Medidor de distâncias: plano

Este documento descreve como o MeshBranch vai medir distâncias, comprimentos e ângulos no modelo 3D. A referência de comportamento é a ferramenta **Measure** do Onshape: o usuário escolhe uma ou duas entidades (vértice, aresta ou face) e o painel mostra as medidas entre elas.

Status: plano. Nada foi programado ainda. Entra no lugar do item "medir distâncias" da fase F6 do `PLAN.md`.

## 1. O que o usuário pode medir

| Seleção | Medidas mostradas |
|---|---|
| 1 vértice | coordenadas X, Y, Z |
| 1 aresta reta | comprimento |
| 1 aresta circular (arco ou círculo) | comprimento, raio, diâmetro, centro |
| 1 face | área, e para face plana a normal; para face cilíndrica o raio e o diâmetro |
| 2 vértices | distância, mais ΔX, ΔY e ΔZ |
| Vértice + aresta | distância mínima, máxima e até o centro da aresta |
| Vértice + face | distância mínima, máxima e até o centro da face; se a face for plana, a distância perpendicular ao plano |
| 2 arestas | distância mínima, máxima e entre os centros; ângulo, se as duas forem retas |
| Aresta + face | distância mínima, máxima e entre os centros; ângulo, se a aresta for reta e a face plana |
| 2 faces | distância mínima, máxima e entre os centros; se as duas forem planas, o ângulo entre elas e, se forem paralelas, a distância perpendicular |
| 2 arestas circulares ou 2 faces cilíndricas | também a distância entre os centros dos círculos ou entre os eixos (furos e pinos) |

Toda distância vem com **ΔX, ΔY e ΔZ**, como no Onshape. A unidade é mm.

Definições:

- **Mínima:** menor distância entre qualquer ponto de A e qualquer ponto de B.
- **Máxima:** maior distância entre qualquer ponto de A e qualquer ponto de B.
- **Centro:** distância entre o centro de A e o centro de B. O centro de uma face é o centroide pela área. O centro de uma aresta é o ponto do meio pelo comprimento. O centro de uma aresta circular é o centro do círculo.

## 2. De onde vêm vértices, arestas e faces

O desenho na tela é feito de triângulos. Para medir como num CAD, o app precisa saber quais triângulos formam cada face do arquivo original.

| Formato | Faces | Arestas | Vértices |
|---|---|---|---|
| STEP | vêm do arquivo: o `occt-import-js` devolve `brep_faces`, a faixa de triângulos de cada face original | calculadas: a fronteira entre duas faces diferentes | calculados: as pontas das arestas |
| STL, OBJ (e os formatos da V1.1) | estimadas: triângulos vizinhos com quase a mesma direção (até 1°) viram uma face | calculadas: fronteira entre faces estimadas | calculados: pontas das arestas |

Passos para o STEP, no worker, depois da leitura:

1. Guardar, para cada triângulo, o número da face original (`faceId`), a partir de `brep_faces`.
2. Juntar os vértices repetidos (mesma posição, tolerância de 1e-6 da caixa do modelo), para saber quais triângulos são vizinhos.
3. Marcar como **aresta** cada lado de triângulo que separa dois `faceId` diferentes, ou que fica na borda da malha.
4. Encadear esses lados em linhas contínuas. Uma linha se quebra onde três ou mais faces se encontram. Cada linha é uma aresta, e suas pontas são vértices.
5. Classificar cada aresta: **reta** (todos os pontos numa reta), **circular** (todos os pontos num círculo, ajuste por mínimos quadrados) ou **curva**.
6. Classificar cada face: **plana** (todas as normais iguais), **cilíndrica** (normais perpendiculares a um eixo comum) ou **outra**.

Esse resultado vai para a página junto com as malhas, numa estrutura `Topology` por peça: faces, arestas, vértices e o `faceId` de cada triângulo. As peças já existem desde a F2, então cada entidade também sabe a que peça pertence.

## 3. Precisão

Os triângulos são uma aproximação das superfícies reais. Os números ficam assim:

| Caso | Precisão |
|---|---|
| Vértices e arestas retas | exatos: os pontos de canto da malha estão na geometria real |
| Faces planas e distância perpendicular | exatas |
| Raio e centro de furos e pinos | exatos até 0,01 mm, pelo ajuste de círculo |
| Comprimento de curvas, distâncias até superfícies curvas | aproximados: o erro máximo é o desvio da malha (hoje 0,1% do tamanho do modelo) |

O painel mostra "≈" antes de um valor aproximado.

Se for preciso mais exatidão no futuro, há dois caminhos. O primeiro é ler o STEP de novo com malha mais fina só para as faces escolhidas (parâmetro `linearDeflection` do `occt-import-js`). O segundo é usar o `BRepExtrema` do OpenCascade, que mede na geometria exata. Ele não existe no `occt-import-js` e exigiria compilar um WASM próprio. Fica fora deste plano.

## 4. Cálculos

Todos rodam num worker, para não travar a tela.

| Medida | Como |
|---|---|
| Ponto a ponto | distância direta |
| Mínima entre aresta/face e outra entidade | ponto mais próximo entre segmentos e triângulos, acelerado por uma árvore de caixas (BVH) |
| Máxima | os pontos mais distantes estão sempre nos vértices da malha: maior distância entre os vértices de A e os de B, usando o fecho convexo de cada um para cortar a conta |
| Centro | centroide pela área (face), ponto do meio (aresta reta), centro do círculo (aresta circular) |
| Ângulo | entre direções de retas e normais de planos, de 0° a 90° |
| Paralelas | se o ângulo for menor que 0,01°, mostra também a distância perpendicular |

Biblioteca para a BVH: [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) (MIT). Ela já mede distância entre malhas (`closestPointToGeometry`) e acelera a escolha com o mouse (raycast), o que também ajuda em modelos grandes.

## 5. Interface

| Parte | Comportamento |
|---|---|
| Botão "Measure" | na barra de vistas; tecla `M`. Liga e desliga o modo de medida |
| Passar o mouse | destaca a entidade sob o cursor, com snap em vértices e arestas (seção 5.1) |
| Clique | escolhe a entidade. O segundo clique escolhe a segunda. Um terceiro clique recomeça do zero |
| `Shift` + clique | troca só a segunda entidade |
| Clique de novo numa entidade escolhida | tira ela da seleção |
| `Esc` | limpa a medida; com nada escolhido, sai do modo |
| Painel "Measure" | painel flutuante no canto inferior direito do visualizador 3D, por cima da cena. Aparece só com o modo ligado. Mostra as duas entidades (tipo e peça) e a tabela de medidas. Pode ser recolhido para uma barra só com o valor principal, e arrastado pela barra do título para outro lugar do visualizador (a posição fica guardada no navegador) |
| Linhas na cena | uma linha tracejada para cada medida (mínima, máxima, centro), com o valor ao lado. Passar o mouse numa linha da tabela destaca a linha na cena |
| Copiar | clique num valor copia o número |
| Peças escondidas | não podem ser escolhidas |

Desenho do painel:

```
┌ MEASURE ─────────────────────── – ✕ ┐
A  Face (plane) · Base
B  Face (plane) · Lid

Minimum      12.40 mm    ΔX 0.00  ΔY 0.00  ΔZ 12.40
Maximum      ≈ 94.31 mm  ΔX 66.0  ΔY 66.0  ΔZ 12.40
Center       12.40 mm    ΔX 0.00  ΔY 0.00  ΔZ 12.40
Perpendicular 12.40 mm
Angle         0.00°
└─────────────────────────────────────┘
```

O painel tem cerca de 320 px de largura e fica 12 px acima da dica "Drag to orbit…" e à esquerda do canto. Ele não cobre o view cube, que fica no canto superior direito. Com o painel Model recolhido à direita, o visualizador fica mais largo e o painel continua no mesmo canto.

O modo de medida desliga a seleção de peças (F2) enquanto está ligado, para um clique não fazer duas coisas.

### 5.1 Snap (grudar no vértice ou na aresta)

Vértices e arestas são pequenos na tela. Sem snap, o usuário quase nunca acerta o clique. Por isso o cursor "gruda" no vértice ou na aresta mais perto, dentro de um raio em pixels.

| Alvo | Raio de snap | Destaque ao passar o mouse | Destaque escolhido |
|---|---|---|---|
| Vértice | 10 px | anel de 10 px na cor de destaque, sempre do mesmo tamanho na tela | ponto cheio, com a letra A ou B |
| Ponto do meio de aresta reta | 8 px | triângulo pequeno | igual, cheio |
| Centro de aresta circular | 8 px | cruz no centro do círculo, com o círculo em destaque | igual, cheio |
| Aresta | 6 px | a aresta inteira em linha grossa (3 px na tela) | linha grossa cheia, com a letra A ou B |
| Face | sob o cursor | a face inteira com a cor de seleção, clara | a face inteira com a cor de seleção, forte |

Prioridade, quando mais de um alvo está no raio: vértice, depois ponto do meio e centro, depois aresta, depois face. Isso é igual ao Onshape.

Cores: a seleção A usa a cor de destaque do app (verde-azulado). A seleção B usa laranja. O hover é a mesma cor, mais clara. As faces recebem uma camada por cima da cor original (com `polygonOffset`, para não piscar), então a cor da peça volta sozinha ao tirar a seleção.

Como funciona:

1. A cada movimento do mouse (no máximo 1 vez por quadro), o app lança um raio do cursor e acha a face sob ele (com a BVH da seção 4).
2. Ele projeta na tela os vértices e as arestas **da peça atingida e das vizinhas**. A projeção só é refeita quando a câmera muda.
3. Ele mede, em pixels, a distância do cursor a cada vértice e a cada segmento de aresta. O mais perto dentro do raio vence, pela prioridade.
4. **Oclusão:** um vértice ou uma aresta escondidos atrás de outra face não contam. O app lança um raio até o ponto candidato e só aceita se nada estiver na frente dele (tolerância de 0,1% do tamanho do modelo).
5. Sem nada no raio, a face sob o cursor fica em destaque.

Atalhos:

- Segurar `Alt` desliga o snap: o clique escolhe só a face.
- Em tela de toque, os raios dobram de tamanho (20 px para vértices).

Um rótulo pequeno junto do cursor diz o que vai ser escolhido: "Vertex", "Midpoint", "Center", "Edge · 12.0 mm" ou "Face (plane)".

Para STL e OBJ (fase M5), o snap usa os vértices e as arestas estimados da seção 2. Antes disso, nesses formatos, o snap fica só nos cantos dos triângulos.

## 6. Onde fica o código

```
src/measure/
├── topology.ts       # faces, arestas e vértices a partir dos triângulos (passos da seção 2)
├── classify.ts       # reta, círculo, plano, cilindro
├── distance.ts       # mínima, máxima, centro, ângulo, perpendicular
├── measure.worker.ts # roda topology e distance fora da tela
├── picker.ts         # entidade sob o mouse: snap, prioridade e oclusão (seção 5.1)
└── overlay.ts        # linhas e rótulos na cena (CSS2DRenderer do three.js)
src/ui/MeasurePanel.tsx
```

A topologia é calculada uma vez por arquivo, só quando o modo de medida é ligado pela primeira vez. Assim, quem só olha o modelo não paga esse custo.

## 7. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| M1 | Ponto a ponto | Modo Measure, snap nos cantos dos triângulos, distância e ΔX/ΔY/ΔZ, linha na cena |
| M2 | Topologia do STEP | Faces vindas de `brep_faces`, arestas e vértices calculados, snap completo da seção 5.1 (vértice, meio, centro, aresta, face) |
| M3 | Uma entidade | Comprimento de aresta, raio e diâmetro de círculos, área de face, tipo de face |
| M4 | Duas entidades | Mínima, máxima e centro para todos os pares da seção 1, com ângulo e distância perpendicular |
| M5 | STL e OBJ | Faces estimadas por direção dos triângulos, para medir também malhas |

## 8. Testes

- Arquivos de exemplo com medidas conhecidas: cubo de 10 mm, placa com furo de 6 mm, dois blocos a 12,4 mm um do outro.
- Testes de código para cada cálculo da seção 4, comparando com os valores conhecidos (tolerância 0,001 mm nos casos exatos).
- Teste de tela: ligar o modo, clicar em duas faces da placa e conferir os valores do painel.
- Desempenho: montagem de 18 peças (`as1_pe_203.stp`) e um STEP com mais de 1 milhão de triângulos. Meta: topologia em menos de 2 s e medida em menos de 100 ms para o modelo pequeno.

## 9. Riscos

| Risco | Plano |
|---|---|
| `brep_faces` faltar em algum STEP | Usar as faces estimadas da M5 |
| Modelo enorme deixar a topologia lenta | Calcular só para as peças visíveis, e mostrar progresso |
| Arestas curvas com poucos pontos | O ajuste de círculo exige pelo menos 5 pontos; abaixo disso a aresta fica "curva" e o valor fica marcado com "≈" |
| Valor aproximado ser tomado como exato | Sempre mostrar "≈" e explicar no título do valor |

## 10. Soluções que já existem

| Projeto | O que aproveitar |
|---|---|
| Onshape Measure | Comportamento e painel: mínima, máxima, centro, ΔX/ΔY/ΔZ |
| [dlebed/step-viewer](https://github.com/dlebed/step-viewer) | Visualizador de STEP no navegador com medidas; referência de como usa os dados do OpenCascade |
| [bernhard-42/three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer) | Destaque de vértice, aresta e face em three.js |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) (MIT) | Distância entre malhas e escolha rápida com o mouse |
| [threejsdemos: Measurement Tool](https://threejsdemos.com/demos/tools/measurement) | "Grudar" no vértice mais próximo ao clicar |

Antes da M2, ler o código do `dlebed/step-viewer` e conferir a licença, para reaproveitar o que for possível.
