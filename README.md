# 📅 Agenda Fácil

Sistema completo de gestão e agendamento para pequenas e médias empresas (salões, clínicas, barbearias, consultórios).

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy)

---

## ✨ Features

### 🔐 Segurança

- Login seguro com OTP via WhatsApp
- Recuperação de senha por email
- Autenticação multi-tenant (organizações isoladas)
- Logs de auditoria completos

### 📊 Analytics

- Faturamento mensal
- Serviços mais vendidos
- Horários de pico
- Estatísticas em tempo real

### 🎨 Personalização

- Tema customizável por organização
- Cores da marca
- Upload de logo

### 🌍 Internacionalização

- Suporte a múltiplos idiomas
- PT-BR e EN-US incluídos

### 📱 Portal do Cliente

- Login com OTP
- Agendamento self-service
- Histórico de agendamentos

### 🚫 Prevenção de Conflitos

- Constraints no banco de dados
- Impossível fazer double booking

---

## 🚀 Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **UI:** Tailwind CSS + Shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Charts:** Recharts
- **i18n:** react-i18next
- **WhatsApp:** whatsapp-web.js (opcional)

---

## 📦 Instalação

### Pré-requisitos

- Node.js 18+
- Conta no Supabase
- Git

### Passo a Passo

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/seu-usuario/agenda-facil.git
   cd agenda-facil
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**

   ```bash
   cp .env.example .env
   ```

   Edite `.env` e adicione suas credenciais do Supabase:

   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-key
   ```

4. **Execute as migrações SQL:**

   - Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
   - Vá em **SQL Editor**
   - Execute os arquivos em `src/database/` na ordem:
     - `01_otp_system.sql`
     - `02_prevent_double_booking.sql`
     - `03_password_recovery.sql`
     - `04_audit_logs.sql`
     - `06_custom_themes.sql`
     - `07_analytics_functions.sql`

5. **Inicie o servidor de desenvolvimento:**

   ```bash
   npm run dev
   ```

6. **Acesse:** `http://localhost:5173`

---

## 🌐 Deploy

### Netlify (Recomendado)

1. **Push para GitHub:**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy na Netlify:**
   - Acesse [netlify.com](https://www.netlify.com/)
   - Conecte seu repositório GitHub
   - Configure as variáveis de ambiente
   - Deploy automático! 🚀

**Guia completo:** [DEPLOY.md](./DEPLOY.md)

---

## 🔑 Métodos de login (opcional)

As telas de acesso consultam `GET /auth/v1/settings` do Supabase e exibem **Google** e **WhatsApp**
somente quando o provedor está ativo — basta ligar no painel, sem novo deploy.

- **Google:** Supabase → Authentication → Sign In / Providers → Google. Informe o Client ID e o
  Client Secret criados no Google Cloud Console (OAuth consent screen + credencial "Web application"
  com o redirect `https://<projeto>.supabase.co/auth/v1/callback`). Em Authentication → URL
  Configuration, inclua `https://<seu-dominio>/dashboard` nas Redirect URLs.
- **WhatsApp:** Supabase → Authentication → Providers → Phone, com provedor **Twilio** (o canal
  WhatsApp exige Twilio e um remetente WhatsApp aprovado na Meta). O código chega pelo WhatsApp
  e a tela `/login/whatsapp` faz a verificação.
- Contas criadas por Google/WhatsApp ainda não têm empresa e são levadas ao onboarding.
- **Manter conectado:** desmarcado, a sessão fica em `sessionStorage` e termina ao fechar o navegador.

**Documentos legais:** `/termos` e `/privacidade`. Defina `VITE_LEGAL_CONTACT_EMAIL` com o e-mail
oficial do encarregado (LGPD art. 41) e revise o texto em `src/pages/legal/legal-content.ts` com
seu jurídico antes de divulgar.

## 📱 WhatsApp Service (Opcional)

Para envio de códigos OTP via WhatsApp:

```bash
cd whatsapp-service
npm install
npm start
```

Escaneie o QR Code com seu WhatsApp e pronto!

**Documentação:** [whatsapp-service/README.md](./whatsapp-service/README.md)

---

## 📚 Documentação

- [Guia de Deploy](./DEPLOY.md)
- [Migrações SQL](./src/database/README.md)
- [WhatsApp Service](./whatsapp-service/README.md)

---

## 🗂️ Estrutura do Projeto

```
agenda-facil/
├── src/
│   ├── components/      # Componentes React
│   ├── pages/          # Páginas
│   ├── hooks/          # Custom hooks
│   ├── context/        # Context providers
│   ├── lib/            # Bibliotecas e configs
│   ├── database/       # Migrações SQL
│   └── i18n/           # Traduções
├── whatsapp-service/   # Serviço WhatsApp (opcional)
├── supabase/           # Edge Functions
├── public/             # Assets públicos
├── netlify.toml        # Config Netlify
└── DEPLOY.md           # Guia de deploy
```

---

## 🔒 Segurança

- ✅ Autenticação JWT via Supabase
- ✅ Row Level Security (RLS) no PostgreSQL
- ✅ Variáveis de ambiente para dados sensíveis
- ✅ HTTPS obrigatório em produção
- ✅ Logs de auditoria

---

## 📝 Licença

MIT License - veja [LICENSE](./LICENSE) para detalhes.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

## 📧 Contato

Desenvolvido por [André Narcizo](https://github.com/DevAndreNarcizo)

---

## 🙏 Agradecimentos

- [Supabase](https://supabase.com/) - Backend as a Service
- [Shadcn/ui](https://ui.shadcn.com/) - Componentes UI
- [Recharts](https://recharts.org/) - Gráficos
- [Netlify](https://www.netlify.com/) - Hosting
