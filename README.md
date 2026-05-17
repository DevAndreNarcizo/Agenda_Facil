# Agenda Facil — Micro-SaaS Appointment Management

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=flat-square&logo=github-actions)](https://github.com/DevAndreNarcizo/Agenda_Facil/actions)
[![Tests](https://img.shields.io/badge/tests-42_passing-27d39f?style=flat-square)](https://github.com/DevAndreNarcizo/Agenda_Facil)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

A complete multi-tenant appointment and business management system for small and medium businesses — salons, clinics, barbershops, and professional offices. Production SaaS with real users.

---

## Features

### Security
- OTP authentication via WhatsApp
- Email-based password recovery
- Multi-tenant with organization isolation
- Complete audit logs

### Analytics
- Monthly revenue dashboards
- Top-selling services
- Peak hour analysis
- Real-time statistics via Supabase RPC

### Customization
- Per-organization theme engine
- Brand colors (primary, secondary, accent)
- Logo upload

### Client Portal
- OTP login for end customers
- Self-service booking
- Appointment history

### Conflict Prevention
- Database-level exclusion constraints
- Double-booking impossible by design

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.9, Vite 6 |
| **UI** | Tailwind CSS 3, Shadcn/ui (Radix) |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **State** | TanStack React Query v5 |
| **Forms** | React Hook Form + Zod |
| **Charts** | Recharts |
| **i18n** | react-i18next (pt-BR, en-US) |
| **Testing** | Vitest |
| **CI/CD** | GitHub Actions |
| **Containers** | Docker, Docker Compose |

---

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/DevAndreNarcizo/Agenda_Facil.git
cd Agenda_Facil
cp .env.example .env
# Edit .env with your Supabase credentials
docker compose up dev
```

Open `http://localhost:5173`

### Without Docker

**Prerequisites:** Node.js 22+, Supabase account

```bash
git clone https://github.com/DevAndreNarcizo/Agenda_Facil.git
cd Agenda_Facil
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Database Setup

Run migrations from `src/database/` in order via Supabase SQL Editor:

1. `01_otp_system.sql` — OTP authentication
2. `02_prevent_double_booking.sql` — Conflict prevention
3. `03_password_recovery.sql` — Password recovery
4. `04_audit_logs.sql` — Audit logging
5. `05_update_otp_with_whatsapp.sql` — WhatsApp OTP integration
6. `06_custom_themes.sql` — Theme customization
7. `07_analytics_functions.sql` — Analytics RPC functions

---

## Production Deployment

### Docker Production Build

```bash
docker compose up app --build -d
```

Serves on port `8080` via Nginx with gzip and cache headers.

### Netlify

See [DEPLOY.md](./DEPLOY.md) for the complete Netlify deployment guide.

---

## Testing

```bash
npm run test           # Run all tests (Vitest)
npm run test -- --watch # Watch mode
```

### Test Coverage

| Area | Tests |
|------|-------|
| CEP utilities | 3 |
| Slug validation | 9 |
| Customer normalizers | 7 |
| Supabase error handling | 10 |
| Phone formatting | 5 |
| Class merging (cn) | 4 |
| Holiday database | 2 |

---

## CI/CD Pipeline

GitHub Actions runs on every push to `main` and `develop`, and on PRs to `main`:

| Job | Steps |
|-----|-------|
| **Lint** | ESLint type-checked rules |
| **Test** | Vitest suite (42 tests) |
| **Build** | TypeScript compile + Vite production build |

Secrets required in GitHub: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Project Structure

```
agenda-facil/
├── src/
│   ├── components/
│   │   ├── dashboard/       # Dashboard-specific components
│   │   └── ui/              # Reusable UI primitives (shadcn)
│   ├── pages/
│   │   ├── auth/            # Login, register, password reset
│   │   ├── dashboard/       # Admin dashboard pages
│   │   ├── onboarding/      # Multi-step setup wizard
│   │   └── portal/          # Client-facing booking portal
│   ├── hooks/               # 11 custom React hooks
│   ├── context/             # Auth context provider
│   ├── lib/                 # Utility libraries
│   ├── database/            # SQL migrations
│   └── i18n/                # PT-BR / EN-US translations
├── supabase/
│   ├── functions/           # Edge Functions (Stripe, WhatsApp, reminders)
│   └── migrations/          # Supabase CLI migrations
├── whatsapp-service/        # Standalone WhatsApp bot (optional)
├── Dockerfile               # Production multi-stage build
├── Dockerfile.dev           # Development container
├── docker-compose.yml       # Full environment orchestration
├── nginx.conf               # Production Nginx config
└── .github/workflows/ci.yml # CI/CD pipeline
```

---

## Security

- JWT authentication via Supabase Auth
- Row-Level Security (RLS) on all PostgreSQL tables
- Environment variables for all secrets
- HTTPS enforced in production
- Audit logs on critical operations

---

## Roadmap

- [x] Docker + Docker Compose
- [x] CI/CD (GitHub Actions)
- [x] Test suite (42 tests)
- [ ] E2E tests with Playwright
- [ ] Stripe subscription management
- [ ] Mobile PWA enhancements

---

**Built by [Andre Narcizo](https://github.com/DevAndreNarcizo)** — MIT License
