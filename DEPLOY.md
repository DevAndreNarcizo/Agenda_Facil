# Guia de Deploy na Netlify

## 🚀 Deploy Automático via GitHub

### Passo 1: Preparar o Repositório

1. **Certifique-se de que o código está no GitHub:**

   ```bash
   git add .
   git commit -m "feat: Preparar para deploy na Netlify"
   git push origin main
   ```

2. **Verifique se `.env` está no `.gitignore`** ✅

---

### Passo 2: Criar Conta na Netlify

1. Acesse [netlify.com](https://www.netlify.com/)
2. Clique em **Sign up**
3. Escolha **Sign up with GitHub**
4. Autorize a Netlify a acessar seus repositórios

---

### Passo 3: Importar Projeto

1. No dashboard da Netlify, clique em **Add new site** > **Import an existing project**
2. Escolha **Deploy with GitHub**
3. Selecione o repositório `Agenda_Facil`
4. Configure o build:
   - **Branch to deploy:** `main`
   - **Build command:** `npm run build` (já configurado no netlify.toml)
   - **Publish directory:** `dist` (já configurado no netlify.toml)

---

### Passo 4: Configurar Variáveis de Ambiente

1. No dashboard do site, vá em **Site settings** > **Environment variables**
2. Adicione as seguintes variáveis:

```
VITE_SUPABASE_URL = https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY = sua-chave-anon-key-aqui
```

**Onde encontrar:**

- Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
- Vá em **Settings** > **API**
- Copie:
  - **Project URL** → `VITE_SUPABASE_URL`
  - **anon public** → `VITE_SUPABASE_ANON_KEY`

---

### Passo 5: Deploy

1. Clique em **Deploy site**
2. Aguarde o build (2-3 minutos)
3. ✅ Site publicado!

**URL gerada:** `https://random-name-123.netlify.app`

---

## 🔧 Configurações Adicionais

### Customizar Domínio

1. **Domínio Netlify:**

   - Site settings > **Domain management** > **Options** > **Edit site name**
   - Escolha: `agenda-facil.netlify.app`

2. **Domínio Próprio:**
   - Site settings > **Domain management** > **Add custom domain**
   - Siga as instruções para configurar DNS

---

### Configurar Redirects (SPA)

✅ **Já configurado no `netlify.toml`!**

Isso garante que rotas como `/dashboard`, `/portal/login` funcionem corretamente.

---

### HTTPS

✅ **Automático!** A Netlify fornece certificado SSL gratuito.

---

## 🐛 Troubleshooting

### Build falha

**Erro:** `Command failed with exit code 1`

**Solução:**

1. Verifique se `package.json` tem o script `build`:
   ```json
   "scripts": {
     "build": "tsc && vite build"
   }
   ```
2. Teste localmente:
   ```bash
   npm run build
   ```

### Página em branco após deploy

**Causa:** Variáveis de ambiente não configuradas

**Solução:**

1. Vá em **Site settings** > **Environment variables**
2. Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Faça **Trigger deploy** (Deploys > Trigger deploy > Deploy site)

### Rotas não funcionam (404)

**Causa:** Redirects não configurados

**Solução:**
✅ Já resolvido no `netlify.toml`! Se ainda tiver problema:

1. Verifique se o arquivo `netlify.toml` está na raiz do projeto
2. Faça novo deploy

---

## 📱 WhatsApp Service

⚠️ **Importante:** O WhatsApp Service **NÃO** pode ser deployado na Netlify (apenas sites estáticos).

**Opções para o WhatsApp Service:**

### Opção 1: Heroku (Recomendado)

```bash
# Criar app
heroku create agenda-facil-whatsapp

# Deploy
git subtree push --prefix whatsapp-service heroku main
```

### Opção 2: Railway

1. Acesse [railway.app](https://railway.app/)
2. Conecte o repositório
3. Configure para deployar apenas a pasta `whatsapp-service`

### Opção 3: DigitalOcean App Platform

1. Crie um App
2. Selecione a pasta `whatsapp-service`
3. Configure variáveis de ambiente

### Opção 4: VPS (Mais controle)

- DigitalOcean Droplet ($5/mês)
- AWS EC2
- Google Cloud Compute Engine

---

## ✅ Checklist de Deploy

Antes de fazer deploy:

- [ ] Código commitado no GitHub
- [ ] `.env` está no `.gitignore`
- [ ] `netlify.toml` está na raiz
- [ ] Testou `npm run build` localmente
- [ ] Tem as credenciais do Supabase

Após deploy:

- [ ] Configurou variáveis de ambiente na Netlify
- [ ] Testou todas as rotas
- [ ] Testou login OTP
- [ ] Verificou se analytics funcionam

---

## 🎯 Deploy Contínuo

Após configurar, **cada push para `main` fará deploy automático!**

```bash
git add .
git commit -m "fix: correção de bug"
git push origin main
# Deploy automático na Netlify! 🚀
```

---

## 📊 Monitoramento

**Analytics da Netlify:**

- Site settings > **Analytics**
- Veja visitantes, performance, etc.

**Logs:**

- Deploys > Selecione um deploy > **Deploy log**

---

## 💰 Custos

**Netlify:**

- ✅ **Grátis** para projetos pessoais
- 100GB bandwidth/mês
- Deploy ilimitados
- HTTPS incluído

**Upgrade ($19/mês):**

- Mais bandwidth
- Formulários
- Funções serverless
