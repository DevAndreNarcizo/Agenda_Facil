# Guia de credenciais e ativação — Agenda Fácil

> **Objetivo:** obter e configurar as credenciais necessárias para Stripe, WhatsApp Cloud API, portal e lembretes sem expor nenhum valor em Git, chat ou frontend.
>
> **Regra:** primeiro configure o projeto Supabase de teste; repita o processo com valores novos no ambiente de produção. Nunca reutilize secrets de teste em produção.

## 1. Onde salvar os valores

No Supabase, abra o projeto correto e acesse **Edge Functions → Secrets**. Crie uma entrada por nome e cole o valor correspondente. Secrets ficam disponíveis às funções sem novo deploy. O Supabase já fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente hospedado; **não crie nem copie esses três manualmente**. [Secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets)

Não envie nenhum valor por chat. Se precisar de apoio, abra a tela de cada serviço e informe apenas que ela está pronta; o preenchimento pode ser feito diretamente no navegador.

## 2. Mapa das variáveis

| Variável | Origem | Destino | Obrigatória |
|---|---|---|---|
| `APP_URL` | URL pública exata do frontend | Edge Function Secret | Sim para Stripe |
| `STRIPE_SECRET_KEY` | Stripe | Edge Function Secret | Sim para Stripe |
| `STRIPE_WEBHOOK_SECRET` | Endpoint de webhook do Stripe | Edge Function Secret | Sim para Stripe |
| `STRIPE_PRICE_STARTER` | Price recorrente Stripe | Edge Function Secret | Sim para Stripe |
| `STRIPE_PRICE_PRO` | Price recorrente Stripe | Edge Function Secret | Sim para Stripe |
| `STRIPE_PRICE_CLINIC` | Price recorrente Stripe | Edge Function Secret | Sim para Stripe |
| `WHATSAPP_CLOUD_API_TOKEN` | Meta Business / System User | Edge Function Secret | Sim para WhatsApp |
| `PHONE_NUMBER_ID` | Meta App → WhatsApp → API Setup | Edge Function Secret | Sim para WhatsApp |
| `WHATSAPP_INTERNAL_SECRET` | Gerado por você | Edge Function Secret | Sim |
| `REMINDERS_CRON_SECRET` | Gerado por você | Edge Function Secret e Supabase Vault | Sim para cron |
| `PORTAL_TOKEN_PEPPER` | Gerado por você | Edge Function Secret | Sim para Portal do Cliente |
| `WHATSAPP_FUNCTION_URL` | URL interna da função | Edge Function Secret | Opcional |
| `REMINDERS_BATCH_SIZE` | Decisão operacional | Edge Function Secret | Opcional; padrão 25 |
| `INTEGRATIONS_CLAIM_TTL_SECONDS` | Decisão operacional | Edge Function Secret | Opcional; 450 a 3600 segundos, padrão 600 |

## 3. Valores gerados por você

Gere **três valores diferentes** para `WHATSAPP_INTERNAL_SECRET`, `REMINDERS_CRON_SECRET` e `PORTAL_TOKEN_PEPPER`. Em Linux, gere um por vez no terminal:

```bash
openssl rand -hex 32
```

Copie cada resultado uma única vez para um gerenciador de senhas e depois para o campo correto do Supabase. Não reutilize o mesmo resultado em mais de uma variável e não o salve em arquivos versionados.

### `APP_URL`

Use a origem pública exata, sem barra final, por exemplo `https://app.seudominio.com`. Ela precisa coincidir com o domínio que abrirá a tela de assinatura, pois `create-checkout` bloqueia origens diferentes. Para teste local, use a URL realmente acessada pelo navegador; para produção, use somente o domínio final com HTTPS.

## 4. Stripe: credenciais, planos e webhook

Faça tudo em **Sandbox/Test mode** primeiro. As chaves de teste começam com `sk_test_`; as chaves reais começam com `sk_live_`. A chave secreta é somente de servidor e não pode ir para o React/Vite. [Chaves Stripe](https://docs.stripe.com/keys?locale=en-GB)

### 4.1 `STRIPE_SECRET_KEY`

1. Entre no [Stripe Dashboard](https://dashboard.stripe.com/).
2. Ative **Sandbox/Test mode**.
3. Abra **Developers/Workbench → API keys**.
4. Revele ou crie uma **secret key** para o Agenda Fácil.
5. Copie a chave `sk_test_...` para `STRIPE_SECRET_KEY` no Supabase de teste.

Para produção, repita em **Live mode** e use uma nova `sk_live_...`. A Stripe permite criar chaves restritas; para o lançamento inicial, a chave precisa conseguir criar Checkout Sessions e processar o fluxo de assinatura. A rotação/revogação é feita pela mesma área de API keys. [Documentação oficial](https://docs.stripe.com/keys?locale=en-GB)

### 4.2 `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_CLINIC`

1. No Stripe em modo de teste, abra **Product catalog → Add product**.
2. Crie os produtos/planos **Starter**, **Pro** e **Clinic**.
3. Para cada um, crie um preço **recorrente**, moeda **BRL**, período **mensal** e o valor comercial decidido.
4. Copie o identificador que começa com `price_` de cada preço.
5. Preencha a variável correspondente, sem inverter os planos:
   - Starter → `STRIPE_PRICE_STARTER`;
   - Pro → `STRIPE_PRICE_PRO`;
   - Clinic → `STRIPE_PRICE_CLINIC`.

Preços recorrentes são entidades próprias do Stripe e não devem ser alterados para mudar valor; crie um novo Price e então atualize a variável do ambiente. [Produtos e preços](https://docs.stripe.com/products-prices/manage-prices?dashboard-or-api=api)

> O código recebe apenas `starter`, `pro` ou `clinic` do navegador e resolve o Price ID no servidor. Não inclua `price_...` no frontend.

### 4.3 `STRIPE_WEBHOOK_SECRET`

1. No Stripe, em modo de teste, abra **Developers/Workbench → Webhooks**.
2. Crie um endpoint com a URL:

   ```text
   https://pretzsmbjwatpbrmnrfw.supabase.co/functions/v1/stripe-webhook
   ```

3. Assine estes eventos:
   - `checkout.session.completed`;
   - `customer.subscription.updated`;
   - `customer.subscription.deleted`;
   - `invoice.payment_failed`.
4. Salve o endpoint, abra-o e revele **Signing secret**.
5. Copie o valor `whsec_...` para `STRIPE_WEBHOOK_SECRET`.

O segredo de assinatura pertence ao endpoint, é diferente da API key e deve ser trocado quando criar o endpoint de produção. [Endpoints de webhook](https://docs.stripe.com/api/webhook_endpoints/create?payment_intent_object-status=)

## 5. Meta / WhatsApp Cloud API

### 5.1 Pré-requisitos

Você precisa de uma conta Meta de desenvolvedor, uma conta/portfólio empresarial Meta e uma aplicação com o produto **WhatsApp**. Para o primeiro teste, use o número de teste fornecido pela Meta; não migre o número comercial antes de validar o fluxo.

1. Entre em [Meta for Developers](https://developers.facebook.com/).
2. Crie uma app do tipo **Business** e adicione o produto **WhatsApp**.
3. Abra **WhatsApp → API Setup** na aplicação.
4. Envie o template de teste para um número autorizado antes de seguir para produção.

A Cloud API envia mensagens para o endpoint `/{PHONE_NUMBER_ID}/messages` usando um Bearer token; uma resposta bem-sucedida contém um identificador `wamid`. [Coleção oficial Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-f2eb9575-f109-4767-ab47-4cf74c14444f)

### 5.2 `PHONE_NUMBER_ID`

1. Em **WhatsApp → API Setup**, localize **Phone number ID**.
2. Copie o identificador numérico exibido — **não é o telefone visível**.
3. Salve-o como `PHONE_NUMBER_ID` no Supabase.

### 5.3 `WHATSAPP_CLOUD_API_TOKEN`

O token temporário da tela API Setup serve apenas para o primeiro smoke test. Para manter lembretes em funcionamento, gere um token de **System User**:

1. Abra o **Meta Business Settings** do portfólio empresarial.
2. Em **Users → System users**, crie um usuário de sistema com papel administrativo apropriado.
3. Dê a ele acesso à app Meta e à conta WhatsApp Business usada pela app.
4. Gere um token para essa app, com as permissões necessárias ao envio e à gestão da conta, normalmente `whatsapp_business_messaging` e `whatsapp_business_management`.
5. Copie o token e salve-o como `WHATSAPP_CLOUD_API_TOKEN`.

Se os rótulos da interface Meta mudarem, mantenha o objetivo: token não temporário associado ao System User, à app e aos ativos WhatsApp corretos. Guarde a data de expiração e crie um lembrete para rotação.

### 5.4 Templates obrigatórios

No **WhatsApp Manager → Message templates**, crie templates na categoria adequada e em `pt_BR`. Os nomes devem ser exatamente em minúsculas:

| Nome | Corpo sugerido | Parâmetros esperados pelo código |
|---|---|---|
| `appointment_reminder` | `Olá, {{1}}! Lembramos do seu agendamento amanhã às {{2}} na {{3}}.` | cliente, horário, organização |
| `portal_otp` | `Seu código de acesso é {{1}}. Ele expira em 5 minutos.` | código OTP |
| `appointment_confirmation` | Não é acionado atualmente; defina os parâmetros antes de habilitar o envio. | nenhum contrato ativo |

A função envia templates aprovados e preenche apenas parâmetros do componente `body`; altere o texto/quantidade de parâmetros somente junto com uma alteração de código. Templates precisam ser criados/aprovados antes do envio. [Templates Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-f2eb9575-f109-4767-ab47-4cf74c14444f)

## 6. Cron de lembretes

A função `send-reminders` exige `x-cron-secret`; uma chamada sem esse cabeçalho retorna `403`.

1. Gere `REMINDERS_CRON_SECRET` conforme a seção 3 e salve-o como Edge Function Secret.
2. No Supabase, crie também uma cópia no **Vault** com o nome `reminders_cron_secret`; o Vault permite que o cron use o valor sem colocá-lo no SQL versionado.
3. Abra **Integrations → Cron/Jobs → Create job**.
4. Programe **uma execução por hora**, por exemplo `0 * * * *`. O worker procura agendamentos entre 24 e 25 horas à frente.
5. Configure um HTTP POST para:

   ```text
   https://pretzsmbjwatpbrmnrfw.supabase.co/functions/v1/send-reminders
   ```

6. Inclua os cabeçalhos `Content-Type: application/json` e `x-cron-secret` recuperado do Vault.
7. Monitore a primeira execução em **Cron → Job runs** e nos logs da Edge Function.

O Supabase Cron usa `pg_cron`, pode chamar Edge Functions e recomenda o Vault para os valores usados nos requests. [Agendar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)

> Quando chegar nessa etapa, peça para eu configurar o Vault e o job pelo MCP: você informa apenas que já inseriu o secret na interface; não precisa revelá-lo no chat.

## 7. Sequência de validação

1. Confirmar que os secrets existem no projeto de teste (sem ler seus valores).
2. Testar um checkout `starter` com usuário `owner` e cartão sandbox Stripe.
3. No Stripe, reenviar o mesmo evento de webhook e confirmar que `webhook_events` não cria duplicidade.
4. Enviar um template WhatsApp ao número de teste autorizado.
5. Criar um agendamento confirmado para o dia seguinte e acionar o cron manualmente uma vez.
6. Conferir `message_deliveries`, os logs sem PII e o status final do lembrete.
7. Só então repetir todo o processo em produção com novas chaves, novos Prices e novo webhook secret.

## 8. O que não deve ser configurado

- `VITE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, token Meta e `whsec_...` nunca entram no frontend, GitHub Actions sem secret ou repositório.
- Não use URL `localhost` no webhook Stripe/Meta de produção.
- Não use o token temporário Meta como solução permanente.
- Não copie chaves de teste para produção.
- Não configure `WHATSAPP_FUNCTION_URL`, `REMINDERS_BATCH_SIZE` ou `INTEGRATIONS_CLAIM_TTL_SECONDS` sem necessidade; os padrões seguros já funcionam.
