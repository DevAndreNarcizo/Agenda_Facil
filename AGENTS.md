# AGENTS.md — Agenda Fácil

> Instruções do projeto para IAs (Codex, Claude Code, Gemini CLI, OpenCode).
> Lido automaticamente a partir da raiz do projeto.

---

## 🎯 Stack

- **Frontend**: React 19.2 + TypeScript 5.9 (strict)
- **Build**: Vite 6 + tsc
- **UI**: Tailwind CSS 3.4 + shadcn/ui (Radix primitives)
- **Estado**: TanStack React Query 5 (server state) + React Context (auth)
- **Formulários**: React Hook Form + Zod 4
- **Internacionalização**: i18next + react-i18next
- **Pagamento**: Stripe (client + server)
- **Backend**: Supabase (database, auth, storage, edge functions)
- **Infra**: Docker (Nginx + app)

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── ui/          → shadcn/ui components
│   └── dashboard/   → dashboard widgets
├── pages/
│   ├── auth/        → Login, Register, Forgot/Reset Password
│   ├── dashboard/   → Analytics, Calendar, Customers, Employees, Settings
│   ├── portal/      → Public client portal
│   └── onboarding/  → Multi-step onboarding wizard
├── hooks/           → Custom React hooks
├── context/         → Auth context
├── lib/             → Utility functions (testados!)
└── i18n/            → Internationalization (pt-BR, en)
supabase/
├── functions/       → Edge functions (create-checkout, send-reminders, etc.)
└── migrations/      → DB migrations
```

## 🛠️ Comandos Principais

```bash
npm run dev          # Dev server
npm run build        # tsc -b && vite build
npm run test         # vitest run
npm run lint         # ESLint 9
```

## 🧪 Testes

- Framework: **Vitest** 4.1
- Testes existentes em `src/lib/` (cep, customer-normalizers, holidays, slug, supabase-errors, utils)
- Escreva testes para toda lógica não-trivial em `src/lib/` e `src/hooks/`
- Nomeie arquivos como `*.test.ts` ou `*.test.tsx`

## 📐 Arquitetura

- **SPA** com React Router DOM 7.9 para navegação
- **TanStack Query** para cache/server state — evite useEffect para fetching
- **React Context** apenas para auth — todo o resto via Query ou props
- **Componentes**: shadcn/ui na pasta `components/ui/`, componentes de domínio em suas respectivas pastas de página
- **Edge Functions** para webhooks e tarefas assíncronas no Supabase

## 🔒 Segurança

- RLS (Row Level Security) no Supabase para todas as tabelas
- Stripe apenas server-side via Edge Functions
- Validação dupla: Zod no front + RLS/Supabase no back
- Secrets em variáveis de ambiente (nunca hardcoded)

## 📝 Convenções

- TypeScript strict mode (`"strict": true`, `noUncheckedIndexedAccess`)
- ESLint 9 com `typescript-eslint`, `react-hooks`, `react-refresh`
- Commits: Conventional Commits em pt-BR (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`)
- Docblock em funções não triviais: `@author André Narcizo`
- Path alias: `@/` → `src/`

## 📍 Caminhos Importantes

- `src/lib/` — funções utilitárias com testes
- `supabase/functions/` — Edge Functions
- `supabase/migrations/` — schema do banco
- `src/components/ui/` — componentes shadcn/ui
