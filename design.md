# Design System — Banco de Questões TEOT (HMA 2027)

Documentação do sistema visual da aplicação, extraída do código-fonte (`src/index.css`, `index.html`, layouts, páginas e componentes). Descreve **o que está implementado hoje**, como os tokens funcionam, quais padrões devem ser reutilizados e onde o sistema ainda tem divergências.

Documentos irmãos: [`README.md`](README.md) · [`architecture.md`](architecture.md) · [`database.md`](database.md)

---

## Sumário

1. [Fundamento: como as cores funcionam neste projeto](#fundamento-como-as-cores-funcionam-neste-projeto)
2. [Tokens de cor](#tokens-de-cor)
3. [Superfícies de entrada (marca)](#superfícies-de-entrada-marca)
4. [Cores funcionais e semânticas](#cores-funcionais-e-semânticas)
5. [Tipografia](#tipografia)
6. [Espaçamento, raio e elevação](#espaçamento-raio-e-elevação)
7. [Estrutura de layout e navegação](#estrutura-de-layout-e-navegação)
8. [Inventário de componentes](#inventário-de-componentes)
9. [Padrões de tela](#padrões-de-tela)
10. [Gráficos e visualização de dados](#gráficos-e-visualização-de-dados)
11. [Iconografia](#iconografia)
12. [Movimento e transições](#movimento-e-transições)
13. [Responsividade](#responsividade)
14. [Camadas (z-index)](#camadas-z-index)
15. [Acessibilidade](#acessibilidade)
16. [Identidade e assets](#identidade-e-assets)
17. [Divergências conhecidas](#divergências-conhecidas)
18. [Como alterar o sistema](#como-alterar-o-sistema)

---

## Fundamento: como as cores funcionam neste projeto

Esta é a decisão que explica praticamente todo o restante do CSS da aplicação, e precisa ser entendida antes de qualquer alteração.

O app foi originalmente escrito em **tema escuro** com a paleta padrão do Tailwind: fundo `bg-slate-950`, cards `bg-slate-900`, texto `text-slate-100`. Ao migrar para a identidade institucional **clara**, em vez de reescrever centenas de classes espalhadas por ~16 mil linhas de JSX, o projeto **redefiniu os tokens do Tailwind v4** em `src/index.css`:

```css
@theme {
  --color-slate-950: #f5f5f5;  /* fundo de página  — era quase preto */
  --color-slate-900: #ffffff;  /* superfície de card */
  --color-slate-800: #d8dbdd;  /* borda padrão */
  --color-slate-100: #2c3a47;  /* texto primário (navy) — era quase branco */
  /* ... */
}
```

**A escala `slate` está deliberadamente invertida.** As mesmas classes que antes produziam "texto claro sobre fundo escuro" agora produzem "texto escuro sobre fundo claro", sem tocar em uma linha de JSX.

Consequências práticas — leia com atenção antes de editar qualquer tela:

| Você lê no JSX | O que realmente aparece |
|---|---|
| `bg-slate-950` | Cinza muito claro `#f5f5f5` (fundo de página) |
| `bg-slate-900` | **Branco** (card) |
| `text-slate-100` | **Navy escuro** `#2c3a47` (texto principal) |
| `text-slate-400` | Cinza médio `#6b7680` (texto secundário) |
| `bg-slate-100` | **Navy escuro** — usado propositalmente no *chrome* (topbar, sidebar, gaveta) |
| `border-slate-800` | Cinza claro `#d8dbdd` |

O `bg-slate-100` do cabeçalho e da barra lateral **não é um erro**: é o token invertido sendo usado para produzir a faixa escura de navegação, com `text-white` e `text-white/70` por cima.

As escalas `amber`, `emerald` e `red` também foram invertidas nos tons baixos (200–400 mais escuros que 500), para que combinações como `text-amber-400` sobre `bg-amber-500/20` mantenham contraste em fundo claro.

---

## Tokens de cor

Todos definidos em `src/index.css`, bloco `@theme`.

### Neutros (escala `slate` — invertida)

| Token | Hex | Papel |
|---|---|---|
| `slate-50` | `#ffffff` | Branco puro |
| `slate-100` | `#2c3a47` | **Texto primário** / fundo do *chrome* escuro |
| `slate-200` | `#35434f` | Texto forte alternativo |
| `slate-300` | `#47555f` | Texto de corpo em tabelas |
| `slate-400` | `#6b7680` | **Texto secundário / muted** |
| `slate-500` | `#838d95` | Texto terciário, legendas |
| `slate-600` | `#9aa2a9` | Ícones muted, placeholders |
| `slate-700` | `#c3c9cd` | Borda com ênfase / hover |
| `slate-800` | `#d8dbdd` | **Borda padrão de card**, chip neutro |
| `slate-900` | `#ffffff` | **Superfície de card** |
| `slate-950` | `#f5f5f5` | **Fundo de página**, inputs, superfície recuada |

### Marca (`teal` — primário) e área administrativa (`cyan`)

| Token | Hex | Papel |
|---|---|---|
| `teal-300` | `#8fc4bb` | Realce claro |
| `teal-400` | `#4aab9b` | Ícones e rótulos de destaque no acesso do candidato |
| `teal-500` | `#1e8c7c` | **Primário da marca** — botões, cards de atalho, seleção |
| `teal-600` | `#146b5e` | Hover do primário |
| `cyan-300` | `#b7ddd6` | Realce claro |
| `cyan-400` | `#6fa89c` | Ícones e rótulos no acesso administrativo |
| `cyan-500` | `#2f9c8c` | **Acento administrativo** — item ativo de menu, tabs, botões |
| `cyan-600` | `#1e8c7c` | Hover administrativo |
| `blue-500` | `#1f6e96` | Azul editorial (gradientes de botão admin) |
| `blue-600` | `#185777` | Hover do azul editorial |

**Convenção de acento por perfil:** o acesso do **candidato** usa `teal`; o **administrativo** usa `cyan` (e o gradiente `cyan-600 → blue-600` nos botões de ação primária). É o que dá a cada área uma identidade sutilmente distinta usando o mesmo sistema.

### Acentos funcionais

| Token | Hex | Papel |
|---|---|---|
| `amber-500` | `#f05400` | Laranja de campanha — uso tático (selos, urgência, "Em Andamento") |
| `amber-400 / 300 / 200` | `#cc4c00` / `#a33d00` / `#7a2e00` | Tons escuros para texto sobre fundo âmbar translúcido |
| `emerald-500` | `#1e8c3f` | Confirmação, acerto, gabarito |
| `emerald-400 / 300` | `#0b7a42` / `#0e6b3b` | Texto sobre fundo verde translúcido |
| `red-500` | `#c7362f` | Erro, exclusão, alerta |
| `red-400 / 300 / 200` | `#9b2c26` / `#a83730` / `#c65850` | Texto sobre fundo vermelho translúcido |
| `purple-500 / 300` | `#4a3b82` / `#7c6bb0` | Acento minoritário (um KPI do dashboard) |
| `gold-500` | `#f5a623` | Reservado a avaliações/estrelas — **sem uso estrutural** |

### O padrão `/15`, `/20`, `/30`

Chips, badges e estados ativos seguem uma fórmula consistente de três partes:

```
bg-<cor>-500/15..20   +   text-<cor>-300..600   +   border-<cor>-500/30
```

Exemplos reais:

```jsx
// Prova ativa
"bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
// Em andamento
"bg-amber-500/20 text-amber-400 border-amber-500/30"
// Item de menu ativo
"bg-cyan-500/15 text-cyan-500 border-cyan-500/40"
// Chip neutro
"bg-slate-800 text-slate-300 border-slate-700"
```

---

## Superfícies de entrada (marca)

As telas antes do login — `HomePage` (splash + gate), `AdminLoginPage` e `RegisterPage` — **não usam os tokens acima**. Elas trabalham com literais de cor, formando um bloco visual próprio, mais "marca" e menos "produto".

| Cor | Hex | Uso |
|---|---|---|
| Verde profundo | `#05413b` | Fundo integral das telas de entrada e da barra inferior mobile |
| Verde de ação | `#079551` | Ícones, foco de input, botão de cadastro, glow de fundo |
| Teal de botão | `#227d74` → `#1b625a` (hover) | Botão "Entrar" |
| Borda de input | `#0f4a43` → `#079551` (foco) | Campos arredondados (`rounded-full`) |
| Âmbar | `#FFCB70` | Glow decorativo e estado ativo da barra inferior mobile |

Padrões visuais dessa família:

- Fundo `#05413b` com **dois glows** desfocados (`w-96 h-96 blur-3xl`): âmbar em cima à esquerda, verde embaixo à direita.
- **Cartão branco** (`bg-white text-[#05413b] rounded-2xl p-6 shadow-2xl`) centralizado, largura máxima `max-w-md`.
- Inputs em **pílula** (`rounded-full`, `pl-11` para o ícone à esquerda), `text-xs`.
- Botões em pílula, `min-h-11`, `font-bold`, com sombra colorida (`shadow-lg shadow-[#227d74]/30`).
- Alertas inline com paleta própria: erro `#FDEEEC` / `#F3C6C0` / `#9b2c26`; aviso `#FFF8E7` / `#F3D9A6` / `#8a6a1f`.

A **splash** é um estágio próprio: ícone do app flutuando em loop, título, subtítulo "O ano da vitória 🏆" e o texto pulsante "clique para continuar". Clicar em qualquer lugar transiciona para o cartão de login (`stage: 'splash' → 'gate'`).

---

## Cores funcionais e semânticas

### Escala de desempenho — a regra mais importante do produto

Qualquer percentual de aproveitamento exibido no app segue uma **única regra de cor**, centralizada em `src/utils/helpers.ts`:

| Faixa | Cor | Hex |
|---|---|---|
| `< 50%` | Vermelho | `#E20018` |
| `50–59%` | Amarelo | `#FFCB70` |
| `≥ 60%` | Verde | `#079551` |

```ts
scoreColorHex(score)   // para preencher barras, fatias e rótulos de gráfico
scoreColorClass(score) // para texto — retorna text-[#E20018] | text-[#FFCB70] | text-[#079551]
```

São hexadecimais deliberadamente **fora** dos tokens `emerald`/`amber`/`red`, para que "nota" seja visualmente distinta de "sucesso/aviso/erro" da interface.

### Estado

| Estado | Cor | Onde aparece |
|---|---|---|
| Sucesso / correto / ativo | `emerald` | Gabarito, prova ativa, usuário ativo, confirmações |
| Atenção / em andamento | `amber` | "Em Andamento", "Não Respondida", avisos de importação |
| Erro / destrutivo | `red` | Falhas, exclusão, prova pendente, alternativa errada |
| Informação / seleção | `cyan` | Filtros ativos, tabs, item de menu selecionado |
| Neutro | `slate` | Estados vazios, chips sem categoria |

### Chip de origem da questão

`getSourceExamChipClass()` (`src/constants.ts`) colore o chip pelo prefixo de `sourceExam`:

| Fonte | Cor |
|---|---|
| `TEOT *` | Verde (`emerald`) |
| `TARO *` | Âmbar (`amber`) |
| `BANCO PRÓPRIO` | Vermelho (`red`) |
| Qualquer outro (legado, ex.: `SBOT`) | Neutro (`slate`) |

---

## Tipografia

Carregadas via Google Fonts em `index.html`; declaradas como tokens em `@theme`.

| Token | Família | Pesos | Uso |
|---|---|---|---|
| `--font-sans` | **Nunito Sans** | 400, 600, 700, 800 | Corpo, formulários, tabelas, navegação — padrão do `body` |
| `--font-display` | **Poppins** | 400, 500, 600, 700 | `h1`, `h2`, `h3` |

Regras de base (`@layer base`):

```css
body        { font-family: var(--font-sans); }
h1, h2, h3  { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.01em; }
h4, h5, h6  { font-family: var(--font-sans); font-weight: 700; }
```

### Escala em uso

| Classe | Aplicação típica |
|---|---|
| `text-[10px]` / `text-[11px]` | Badges, chips, rótulos de eixo, metadados |
| `text-xs` (12px) | **Densidade padrão da UI** — formulários, tabelas, botões, a maior parte do admin |
| `text-sm` (14px) | Títulos de card, enunciados em listas, texto de corpo |
| `text-base` (16px) | Enunciado da questão durante a prova |
| `text-lg` / `text-xl` | Títulos de seção e de página |
| `text-2xl` / `text-3xl` | Nome da prova em telas de destaque |
| `text-5xl` – `text-7xl` | Percentuais de desempenho (`font-black`) |

**Peso como hierarquia:** `font-black` para números-KPI, `font-extrabold` para títulos de página, `font-bold` para títulos de card e botões, `font-semibold` para rótulos, `font-medium`/normal para corpo.

A interface é **deliberadamente densa** (`text-xs` domina): é uma ferramenta de trabalho para o admin e de estudo focado para o residente, não uma landing page.

---

## Espaçamento, raio e elevação

### Raio (borda arredondada)

| Classe | Uso |
|---|---|
| `rounded-lg` | Botões de ícone, chips quadrados, letras de alternativa |
| `rounded-xl` | Inputs, selects, botões de ação, cards internos |
| `rounded-2xl` | **Card padrão**, modais, containers principais |
| `rounded-3xl` | Banner de KPI do resultado da prova |
| `rounded-full` | Badges, pílulas, avatares, FAB, inputs das telas de entrada |

### Sombra

| Classe | Uso |
|---|---|
| `shadow-md` | Botões |
| `shadow-lg shadow-<cor>-500/20..30` | Ações primárias, com halo colorido |
| `shadow-xl` | **Card padrão** |
| `shadow-2xl` | Modais, gavetas, cartões de login |

### Espaçamento

- Ritmo vertical entre seções: `space-y-6` (mobile) → `space-y-8` (≥ sm).
- Padding interno de card: `p-4` (mobile) → `p-6` (≥ sm).
- Gap de grade: `gap-4` padrão; `gap-6` em grades de duas colunas.
- Padding do container principal: `px-3 sm:px-6 lg:px-8`, com `lg:pl-[calc(1rem+4rem)]` reservando a faixa da sidebar recolhida.
- `pb-12` no fim de páginas longas e `pb-20 lg:pb-6` no `<main>`, para o conteúdo não ficar sob a barra inferior mobile.

### Card padrão

O bloco mais repetido de toda a aplicação:

```jsx
<div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
```

---

## Estrutura de layout e navegação

Dois layouts (`UserLayout`, `AdminLayout`) implementam a mesma anatomia, com itens e acento diferentes.

```
┌───────────────────────────────────────────────────────────┐
│ TOPBAR  (sticky, bg navy, h-14 sm:h-16)                   │
│  ☰   [logo]  Título da página            [avatar] [Sair]  │
├────┬──────────────────────────────────────────────────────┤
│ S  │                                                      │
│ I  │  <main>  conteúdo da rota                            │
│ D  │  max-w-7xl (user) / max-w-[1920px] (admin)           │
│ E  │                                                      │
│ ▸  │                                                      │
├────┴──────────────────────────────────────────────────────┤
│ RODAPÉ (≥ sm, só no acesso do candidato)                  │
└───────────────────────────────────────────────────────────┘
        ╭──────────────╮
        │  ◐   ⌂   ◑   │  barra inferior flutuante (< lg)
        ╰──────────────╯
```

### Topbar

Sticky (`z-40`), fundo navy (`bg-slate-100`), borda `border-white/10`. Contém hambúrguer (mobile), logo (desktop), **título da página derivado da rota ativa** e o bloco de conta (avatar + botão Sair). O avatar aparece sozinho no mobile e como chip com nome a partir de `sm`.

### Sidebar de desktop (≥ lg)

Padrão idêntico nos dois acessos: **fixa, colada à esquerda, recolhida a `w-16` (só ícones), expandindo para `w-64` no hover**, como *overlay* — não empurra o conteúdo. Implementada com `group/sidebar` + `group-hover/sidebar:`.

O avatar do usuário fica **ancorado no rodapé da sidebar** (`dropUp`), dando acesso a Notificações e Perfil.

### Gaveta mobile (< md no candidato, < lg no admin)

Desliza da esquerda com `translate-x`, `duration-300`, sobre um *backdrop* com `backdrop-blur-sm`. No acesso do candidato ocupa **50% da largura** (`w-1/2 max-w-xs`); no admin, `w-64`.

### Barra inferior flutuante (< lg)

Pílula flutuante centralizada (`bg-[#05413b]/95 backdrop-blur-md rounded-full`), com **três ícones**: Home ao centro e dois atalhos por perfil (candidato: Histórico e Desempenho; admin: Questões e Provas). Respeita `env(safe-area-inset-bottom)` e **some ao rolar para baixo, reaparecendo ao rolar para cima**.

### Item de navegação ativo

```jsx
isActive
  ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/40 font-semibold shadow-sm'
  : 'text-white/70 hover:bg-white/10 hover:text-white'
```

Ativo = `location.pathname.startsWith(item.path)`.

### Modo prova (tela cheia)

Durante `/app/exams/:assignmentId`, o `UserLayout` detecta a rota e renderiza **apenas o conteúdo** — sem topbar, sidebar, gaveta, rodapé ou barra inferior. A `TakeExamPage` desenha o próprio topo minimalista: nome da prova centralizado e um **indicador de progresso em pizza** (`conic-gradient` de 32×32 px, teal sobre navy).

---

## Inventário de componentes

`src/components/` — 13 componentes reutilizáveis.

| Componente | Responsabilidade | Notas de design |
|---|---|---|
| `Avatar` | Foto ou inicial do nome | 3 tamanhos (`sm`/`md`/`lg`); cor por perfil (admin cyan, usuário teal) |
| `AvatarAccountMenu` | Avatar clicável → Notificações / Perfil | Badge vermelho de não lidas (`9+` acima de 9); `dropUp` e `align` para uso em rodapé de sidebar |
| `MobileBottomNav` | Barra inferior flutuante | Some/reaparece pelo scroll; só ícones |
| `NotificationToastHost` | Pop-ups em tempo real | Canto superior direito, `z-60`, auto-dismiss em 6 s, animação `fadeSlideIn` |
| `CheckboxMultiSelect` | Dropdown com caixas de seleção | Fecha ao clicar fora; "Limpar seleção"; rótulo dinâmico ("3 temas selecionados") |
| `Switch` | Toggle on/off | `role="switch"` + `aria-checked`; trilho 36×20 px |
| `QuestionImage` | Imagem da questão | Zoom em modal, *fallback* com link direto, normaliza caminho relativo → absoluto |
| `AddQuestionImageModal` | Anexar imagem sem abrir a edição completa | Aceita arquivo **ou colar (Ctrl+V)**; pré-visualização antes de confirmar |
| `QuestionPreviewModal` | Pré-visualização administrativa | Mostra o gabarito de propósito; chips "Já utilizada em"; copiar ID |
| `CommentMedia` | Mídia do comentário do gabarito | Detecta YouTube → iframe; senão imagem com zoom e *fallback* |
| `ReferenceSource` | Bloco "Fonte: …" | Link para o PDF da referência; some quando não há referência |
| `RankingChart` | Ranking horizontal | Reutilizado no Dashboard (com drill-down) e no Desempenho (leitura); barras coloridas por `scoreColorHex`; não selecionados a 35% de opacidade |
| `CsvBulkImportSection` | Importação CSV de materiais | Prévia + confirmação, no mesmo padrão das demais seções de importação |

---

## Padrões de tela

Repertório recorrente. Reutilize em vez de inventar.

### Carregando

```jsx
<div className="flex flex-col items-center justify-center py-20 text-slate-400">
  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
  <p className="text-xs">Carregando ...</p>
</div>
```

Spinner `teal` no acesso do candidato, `cyan` no administrativo. A mensagem é sempre **específica** ("Calculando indicadores de desempenho…", "Iniciando ambiente seguro da prova…"), nunca "Carregando…" genérico. A tela de prova ainda alterna dicas a cada 2,8 s.

### Vazio

Texto centralizado, `text-xs text-slate-500 italic`, ou card com ícone + título + orientação do que fazer a seguir.

### Modal

```jsx
<div className="fixed inset-0 z-50 bg-slate-100/80 backdrop-blur-sm flex items-center justify-center p-4">
  <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
      <h3 className="text-sm font-bold text-slate-100">Título</h3>
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
    {/* corpo */}
  </div>
</div>
```

O *scrim* é `bg-slate-100/80` — ou seja, **navy a 80%** com desfoque (token invertido). Modais longos usam `max-h-[90vh] overflow-y-auto` com cabeçalho `sticky top-0`.

**Tela cheia** (apresentações de Aulas e Sabatinas): `fixed inset-0 bg-black flex flex-col`, faixa de título navy e iframe ocupando o resto.

### Alerta inline

```jsx
<div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
  <span>{mensagem}</span>
</div>
```

Mesma estrutura com `emerald` (sucesso) e `amber` (atenção).

### Checkbox de configuração

Usado no grupo de opções da prova (Etapa 1 do assistente). Rótulo em uma linha e **explicação do efeito** logo abaixo, em `text-[10px] text-slate-500` — a opção diz o que faz sem exigir que o admin descubra testando:

```jsx
<label className="flex items-start gap-2 text-slate-300 cursor-pointer">
  <input type="checkbox" className="mt-0.5 rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0" />
  <span>
    Embaralhar ordem das questões para cada candidato
    <span className="block text-[10px] text-slate-500">
      Cada residente recebe uma ordem própria, que se mantém a mesma se ele retomar a prova.
    </span>
  </span>
</label>
```

`items-start` + `mt-0.5` no input alinham a caixa com a **primeira linha** do rótulo, não com o centro do bloco.

**Opção dependente:** quando uma configuração só faz sentido com outra ligada, ela é desabilitada (`disabled`, `opacity-50`, rótulo em `text-slate-500`) e a explicação **muda** para dizer de que ela depende — em vez de simplesmente sumir ou ficar clicável sem efeito.

### Barra de filtros

No **desktop (≥ lg)** vira uma coluna lateral fixa (`lg:w-72 xl:w-80`, `sticky top-20`) ao lado do conteúdo. No **mobile** fica acima da lista, `sticky`, e **some ao rolar para baixo** (`useHideOnScroll`).

Dois detalhes que já custaram bugs e estão comentados no código:

- **Sem `overflow-y-auto` no container de filtros** — um container com overflow recorta os dropdowns absolutamente posicionados dentro dele, e eles "sumiam atrás" do fundo.
- **`z-20`, não `z-30`** — a sidebar do layout usa `z-30` para se sobrepor ao conteúdo quando expande; com empate, a barra de filtros ficava por cima dela.

A barra sempre termina com o **contador em destaque**: número em `text-4xl font-extrabold text-cyan-400` e o rótulo "questões filtradas".

### Progresso de operação em lote

Rótulo + `processados / total` + trilha `h-3 rounded-full` com preenchimento `bg-cyan-500` e `transition-all duration-200`. Usado nas quatro rotinas de importação.

### Tabela

```jsx
<table className="w-full text-left text-xs text-slate-300">
  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
  <tbody className="divide-y divide-slate-800/80">
```

Sempre dentro de `overflow-x-auto`. Linhas clicáveis usam `hover:bg-slate-800/40 cursor-pointer` + `title` explicando o destino; ações internas param a propagação (`e.stopPropagation()`).

Tabelas longas paginam **5 linhas por página**, com controles Anterior/Próxima e indicador "Página X de Y".

### Ação flutuante (FAB)

Na execução da prova, o botão de avançar é um FAB circular `w-14 h-14` verde, fixo no canto inferior direito, que **só aparece depois que uma alternativa é selecionada**. Na última questão ele vira um botão largo vermelho "Finalizar" ocupando a largura da tela.

---

## Gráficos e visualização de dados

Biblioteca: **recharts**, sempre dentro de `ResponsiveContainer`.

| Gráfico | Onde |
|---|---|
| Barras horizontais (ranking) | `RankingChart` — Dashboard e Desempenho |
| Barras horizontais (aproveitamento por área) | Resultado da prova |
| Barras verticais | Dashboard (área, grupo), Estatísticas TEOT/TARO (por ano) |
| Área (evolução temporal) | Dashboard e Desempenho |
| Radar (você × colegas) | Desempenho — só com ≥ 3 áreas |
| Rosca / donut | Desempenho (área e grupo), distribuição por tema, temas mais cobrados |

### Convenções

- **Cor por valor, não por série**, sempre que o número for uma nota: `<Cell fill={scoreColorHex(valor)} />`.
- Paleta categórica (`PIE_COLORS`), quando a cor é apenas identidade de fatia:
  `#2C3A47`, `#2F9C8C`, `#079551`, `#a855f7`, `#f472b6`, `#f97316`, `#10b981`, `#6366f1`, `#C7362F`.
- Eixos: `tick={{ fill: '#6B7680', fontSize: 11 }}`; valores numéricos em `#9AA2A9`, `fontSize: 10`.
- Grade: `#F2F2F5`, geralmente com apenas um eixo visível (`horizontal={false}` ou `vertical={false}`).
- Tooltip claro: `{ backgroundColor: '#ffffff', borderColor: '#F2F2F5', borderRadius: '12px', fontSize: '12px' }`.
- Raio nas barras: `[0,6,6,0]` (horizontal) ou `[4,4,0,0]` (vertical).
- Roscas: `innerRadius="45%"–"72%"`, `paddingAngle={2}`, com o número total sobreposto no centro.
- Gráficos aparecem **condicionalmente**: evolução exige ≥ 2 provas concluídas, radar exige ≥ 3 áreas — nada de eixo vazio.

Em pizzas com muitas fatias, apenas os **5 maiores** viram fatia própria; o resto é somado em "Outros" (`#6B7680`).

---

## Iconografia

**lucide-react**, exclusivamente. Sem SVG solto, sem outra biblioteca.

| Tamanho | Uso |
|---|---|
| `w-3 h-3` | Dentro de chips e badges |
| `w-3.5 h-3.5` | Botões de ação em tabela, ícones inline |
| `w-4 h-4` | **Padrão** — navegação, botões, títulos de seção |
| `w-5 h-5` | Título de página, sair, hambúrguer |
| `w-8 h-8` | Cards de atalho da Home, estados vazios |

Vocabulário estabelecido — reutilize:

`FileText`/`FileCheck` provas · `BookOpen` questões · `History` histórico/resultados · `BarChart3`/`TrendingUp` desempenho · `Users` usuários · `UploadCloud` importar · `GraduationCap` TEOT/TARO · `Sparkles` extras · `MessageSquare` sabatinas · `CalendarDays` cronograma · `Bell` notificações · `LayoutDashboard` dashboard · `Trash2` excluir · `Pencil`/`Edit` editar · `Eye` visualizar · `Send` convite · `Power`/`PowerOff` ativar/desativar · `Camera` foto.

---

## Movimento e transições

**framer-motion** nas telas de entrada e em transições de conteúdo; CSS puro no resto.

### Easings nomeados

```ts
const BOUNCE_EASE = [0.34, 1.56, 0.64, 1];  // entrada do bloco de marca (overshoot)
const SMOOTH_EASE = [0.22, 1, 0.36, 1];     // transições gerais, sem overshoot
```

### Padrões

| Contexto | Movimento |
|---|---|
| Splash | Ícone/título/subtítulo entram em *stagger* (0 / 0,12 / 0,22 s) com bounce; o ícone segue flutuando em loop de 2,4 s (`y`, `rotate`, `scale`) |
| "clique para continuar" | Opacidade pulsante 0,35 ↔ 0,85, loop de 2,6 s |
| Splash → login | `layout` + `spring` (`stiffness: 90, damping: 20`) |
| Troca de cartão (usuário ↔ admin) | `AnimatePresence mode="wait"` com deslize horizontal ±16 px |
| Troca de filtro em painéis | Fade + deslize vertical de 8 px, 0,25 s |
| Troca de valor em KPI/donut | `key` no valor + fade/slide de 6 px |
| Pop-up de notificação | `@keyframes fadeSlideIn` — 0,25 s, `translateY(-8px)` → 0 |
| Sidebar hover | `transition-[width] duration-200` |
| Gaveta mobile | `transition-transform duration-300 ease-out` |
| Barra inferior / filtros | `translate-y` de 300 ms conforme a direção do scroll |
| Hover geral | `transition-colors` / `transition-all` (padrão do Tailwind, ~150 ms) |

Princípio observado: **movimento tem função** — sinaliza mudança de estado, entrada de conteúdo ou direção de navegação. Não há animação puramente decorativa fora da splash.

---

## Responsividade

Mobile-first, com os breakpoints padrão do Tailwind.

| Breakpoint | Largura | O que muda |
|---|---|---|
| base | < 640 px | Coluna única; gaveta; barra inferior; avatar sem nome; rodapé oculto |
| `sm` | ≥ 640 px | Grades de 2 colunas; chip com nome; rodapé visível; padding e tipografia maiores |
| `md` | ≥ 768 px | Navegação horizontal na topbar (candidato); grades de 2–3 colunas |
| `lg` | ≥ 1024 px | **Sidebar fixa**; barra de filtros vira coluna lateral; barra inferior some; grades de 3–4 colunas |
| `xl` | ≥ 1280 px | Grades de 4 colunas; barra de filtros mais larga (`w-80`) |

Larguras máximas: `max-w-7xl` no acesso do candidato, `max-w-[1920px]` no administrativo (tabelas densas aproveitam telas largas), `max-w-md` em formulários e telas de entrada, `max-w-3xl` na execução da prova (conforto de leitura).

Cuidados presentes no código: `min-h-dvh` em vez de `min-h-screen` no layout do candidato (barra de endereço em iOS), `env(safe-area-inset-bottom)` na barra flutuante, `overscroll-behavior-y: none` no `body`, `truncate`/`line-clamp-2` em todo texto de largura incerta, e `min-w-0` nos containers flex que contêm texto truncável.

---

## Camadas (z-index)

| Camada | Conteúdo |
|---|---|
| `z-20` | Barra de filtros sticky, dropdowns de seleção múltipla |
| `z-30` | Sidebar de desktop, topo sticky da prova |
| `z-40` | Topbar, barra inferior mobile, FAB, backdrop da gaveta |
| `z-50` | Modais, gaveta mobile, visualizadores em tela cheia |
| `z-[60]` | Pop-ups de notificação — sempre acima de tudo |

---

## Acessibilidade

### Implementado

- **Alvo de toque de 44×44 px** — utilitário `.tap-target` (WCAG 2.5.5) aplicado a botões de ícone que ficariam menores no mobile (hambúrguer, fechar, barra inferior). Botões de formulário usam `min-h-11`.
- `aria-label` em botões apenas-ícone; `title` como dica em hover.
- `role="switch"` + `aria-checked` no `Switch`; `aria-hidden` em elementos decorativos.
- `alt` em todas as imagens; textos de *fallback* quando a imagem falha.
- `lang="pt-BR"` no documento; toda a interface em português.
- Foco visível em campos (`focus:border-cyan-500`, `focus:ring-2 focus:ring-teal-500/50`).
- Hierarquia semântica de cabeçalhos (`h1` por página, `h2` por seção).
- `overflow-x-auto` em todas as tabelas — sem rolagem horizontal da página.

### Pontos de atenção

- **Densidade tipográfica**: `text-[10px]` e `text-[11px]` são frequentes em metadados; abaixo do confortável para leitura prolongada.
- **Cor como único canal** em alguns pontos: a escala de desempenho depende só da cor — o histórico mitiga com ícones (`ThumbsUp`/`AlertTriangle`/`OctagonAlert`), mas gráficos e tabelas não.
- **Contraste do amarelo** `#FFCB70` sobre branco é baixo para texto (aceitável em preenchimento de gráfico, discutível em rótulo).
- `focus-visible` não é tratado de forma consistente em todos os botões customizados.
- Modais não implementam *focus trap* nem fechamento por `Esc` (fecham por clique no *scrim* ou no X).

---

## Identidade e assets

| Asset | Caminho | Uso |
|---|---|---|
| Ícone do app (192/512/maskable) | `public/icons/` | PWA, topbar, sidebar, gaveta, splash |
| Apple touch icon | `public/icons/apple-touch-icon.png` | iOS |
| Prévia social | `public/social-preview.png` (1200×630) | Open Graph / Twitter Card |
| Logos institucionais | `design/icons/logo_nova.{svg,png}`, `logo_nova_amarela.{svg,png}` | Fonte de marca (não referenciados em runtime) |

Nome do produto: **"TEOT HMA 2027"** (`index.html`, `manifest.webmanifest`); nome longo em `metadata.json`: "Treinamento TEOT HMA 2027". Tagline: **"O ano da vitória 🏆"**.

**PWA:** `display: standalone`, `background_color` e `theme_color` `#FFCB70`, `start_url: "/"`. Instalável, com ícone e splash — **sem service worker**, portanto sem funcionamento offline.

---

## Divergências conhecidas

Pontos onde a implementação atual não é internamente consistente. Nenhum é bug funcional; todos são candidatos naturais a uma próxima passada de unificação.

| # | Divergência | Detalhe |
|---|---|---|
| 1 | **Duas identidades cromáticas** | Telas de entrada e barra inferior usam verde profundo `#05413b` + âmbar `#FFCB70`; o produto usa teal SBOT `#1e8c7c` + navy `#2c3a47`. Sem token compartilhado entre elas. |
| 2 | **`theme-color` inconsistente** | `index.html` declara `#1E8C7C`; `manifest.webmanifest` declara `#FFCB70`. |
| 3 | **Faixa intermediária de desempenho** | `helpers.scoreColorHex` usa `#FFCB70` para 50–59%; `PerformancePage.TIER_STYLES` usa `cyan-500` na mesma faixa. |
| 4 | **Tooltips de gráfico** | A maior parte usa tooltip claro (`#ffffff`/`#F2F2F5`); o Dashboard usa tooltip escuro (`#23303B`/`#2C3A47`), resquício do tema original. |
| 5 | **Barras de progresso por área** | `UserDetailPage` usa `teal`/`amber` por limiar de 60%, em vez de `scoreColorHex` (três faixas). |
| 6 | **Cores de gráfico fora dos tokens** | `PIE_COLORS` e alguns gradientes usam hex do Tailwind padrão (`#a855f7`, `#f472b6`, `#34d399`, `#f87171`…) sem passar pelo `@theme`. |
| 7 | **Scrollbar** | `::-webkit-scrollbar` usa `#f4f6fb` / `#a8b0d2` — paleta anterior, não derivada dos tokens atuais. |
| 8 | **`gold-500` órfão** | Token definido, nenhum uso no código. |
| 9 | **Literais de hex no JSX** | ~40 ocorrências de `#079551` e ~23 de `#05413b` embutidas diretamente, fora do sistema de tokens. |

---

## Como alterar o sistema

**Regra número um: mude o token, não a classe.**

1. **Cor global** → edite `@theme` em `src/index.css`. Uma linha ali repropaga por toda a aplicação.
2. **Tipografia** → `--font-sans` / `--font-display` em `@theme` **e** o `<link>` do Google Fonts em `index.html`.
3. **Cor de nota/desempenho** → `scoreColorHex` e `scoreColorClass` em `src/utils/helpers.ts` (e alinhe `TIER_STYLES` em `PerformancePage`, ver divergência #3).
4. **Novo chip de estado** → siga a fórmula `bg-<cor>-500/15..20 + text-<cor>-300..600 + border-<cor>-500/30`.
5. **Novo componente** → verifique antes o [inventário](#inventário-de-componentes); `CheckboxMultiSelect`, `Switch`, `Avatar` e `QuestionImage` já cobrem a maior parte das necessidades.
6. **Novo gráfico** → recharts dentro de `ResponsiveContainer`, eixos e tooltip conforme as [convenções](#gráficos-e-visualização-de-dados), e cor por `scoreColorHex` quando o valor for uma nota.

**Antes de editar qualquer JSX, releia [Fundamento](#fundamento-como-as-cores-funcionam-neste-projeto).** Trocar `bg-slate-900` por `bg-white` "para clarear" não muda nada — já é branco. Trocar `text-slate-100` por `text-slate-900` deixa o texto **branco sobre branco**.
