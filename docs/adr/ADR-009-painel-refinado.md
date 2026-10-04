# ADR-009 — Painel refinado (design system AgendaFácil · direção A)

**Status:** aceito  
**Data:** 2026-10-04

## Contexto

O painel autenticado usava o visual "Stitch" (índigo, negrito/caixa-alta, cantos de 32–40px, cards pesados). O handoff do Claude Design (`Agenda Facil Refinado.dc.html`) definiu um visual sóbrio: paleta da logo (Primary `#087BF5`, Navy `#092343`), Inter, bordas finas, raios 10/12px, tema claro/escuro e responsividade sem espaços vazios. A agenda exigia comportamentos que o `react-big-calendar` não oferece sem contorções: clique em horário vazio com horário pré-preenchido, painel lateral fixo (sem modal) e sobreposição lado a lado.

## Decisão

- **Tokens com escopo.** Variáveis `--af-*` em `src/index.css` (claro em `:root`, escuro em `.dark`), expostas no Tailwind como `af-*`. As telas públicas (login, portal, reserva) continuam nos tokens `stitch-*`, sem regressão visual.
- **Primitivos únicos.** `src/components/panel/` concentra PageHeader, Panel, KpiStrip, Segmented, botões, switch, campos, ListTable/Pagination, RowMenu, PanelDialog e ConfirmDialog. As páginas não repetem estilos de componente.
- **Layout responsivo por breakpoint.** Sidebar 232px (≥1100), rail de ícones 64px (720–1099) e barra inferior (<720). Itens de navegação respeitam os mesmos perfis das `ProtectedRoute`.
- **Agenda com grade própria.** `react-big-calendar` foi removido. `calendar/agenda-model.ts` (puro e testado) normaliza agendamentos/bloqueios no fuso `America/Sao_Paulo`, distribui sobreposições em faixas e detecta conflito antes do envio. A validação definitiva continua na Edge Function `manage-appointment` (ADR-006/007).
- **Semana de segunda a domingo** (convenção pt-BR do design). `getAppointmentUtcRange` passou a iniciar na segunda; testes atualizados.
- **Estado na URL.** Data, visão, filtros e item selecionado (`appointment`/`block`) ficam na query string; o Início abre um agendamento direto no painel lateral.
- **Dados reais, sem simulação.** Blocos do protótipo sem backend foram omitidos em vez de simulados: alternância de cobrança anual (o `create-checkout` só tem preço mensal), tabela de faturas, opções "confirmação manual/lembrete/verificação por código" e variação percentual dos KPIs.
- **Recharts removido.** Os gráficos do Analytics são colunas em CSS, como no design, sem dependência de biblioteca de gráficos.

## Consequências

- Horário de funcionamento (`organization_business_hours`) passa a ser editável em Configurações e define a janela visível da agenda e a ocupação do Início.
- A grade carrega o período inteiro em lotes de 1.000 (`useAppointments(filters, { fetchAll: true })`). Métricas do Início e da Assinatura vêm da RPC `get_period_summary` (migration 20261004_000001), sem depender de listas paginadas.
- O e2e da agenda usa `data-agenda-event` e `data-service-id` como seletores estáveis.
- Fontes (Inter e Material Symbols) seguem via Google Fonts; empacotá-las localmente é recomendado para não depender da CDN.
