# AgendaFácil Angular — migração incremental

Aplicação Angular 22.2.3, standalone, TypeScript/Angular templates estritos e rotas lazy. O React na raiz permanece preservado. Esta aplicação é uma primeira vertical local; paridade completa e homologação comercial continuam sujeitas aos gates em `../../docs/implementation/STATUS.md`.

## Execução local

Requer Node compatível com Angular 22 (ambiente verificado: Node 24.22.0), npm e a API Laravel local em `http://127.0.0.1:8000`.

```sh
npm ci
npm start
```

Acesse `http://127.0.0.1:4200`. `proxy.conf.cjs` encaminha `/api` e `/sanctum` same-origin, lendo `API_PROXY_TARGET` quando definido; no Compose o destino é `http://api:8000`. Não configure credenciais de Supabase no Angular.

A autenticação usa cookies Sanctum HttpOnly e XSRF; nenhuma credencial de sessão é persistida no localStorage. O tema visual é a única preferência persistida no browser. O tenant e os entitlements vêm do servidor; os guards da interface complementam a autorização definitiva da API.

## Validação

```sh
npm run build
npm test
npm run test:e2e
npm audit
```

Playwright inicia o frontend e usa a API local real. O teste do ciclo completo cria exclusivamente usuários, organizações, serviços, profissionais e reservas sintéticos com identificadores únicos. Não executar contra produção. `E2E_BASE_URL` permite selecionar um frontend de teste já configurado. Artefatos de falha são ignorados em `test-results/` e `playwright-report/`.

O ciclo ampliado verifica reserva pública com slots reais, confirmação, reagendamento, bloqueio e liberação do horário, calendários de dia/semana/mês, cancelamento por segredo para cliente sem email, checkout indisponível antes da homologação e portal com email Mailpit, cookie HttpOnly, cancelamento e logout. As consultas de slots são sincronizadas pela resposta da API e pela renderização dos resultados; o teste não presume que um botão temporariamente habilitado signifique consulta concluída. Evidências e históricos de revalidação ficam em `qa-evidence/frontend-final.txt` e `qa-evidence/frontend-e2e.txt`.

## Dependências e identidade

- Tokens `--af-*`, logo, Inter local e breakpoints 720/1100 preservam a direção aprovada do legado. Portal/reserva preservam a família visual pública e Plus Jakarta Sans local.
- Ações usam um tom azul com contraste de texto maior; foco visível, navegação por teclado, dialogs nativos e reflow são alvos de qualidade. As verificações realizadas não certificam conformidade WCAG.
- O logo da navegação mantém nome acessível quando o texto visual é ocultado no tablet, e a página atual usa `aria-current`. As bordas funcionais usam `--af-control-line`, separado das bordas decorativas: contraste calculado mínimo de 3,25:1 nos fundos claros e 4,09:1 nos escuros, com checagem adicional das cores computadas no E2E. Erros de intervalo do expediente e dos bloqueios têm descrição associada, `aria-invalid` e foco no primeiro campo inválido. A associação de erros dos demais formulários, a navegação completa por leitor de tela e todas as combinações de marca/tema continuam pendentes de auditoria.
- QR Code é gerado localmente pela biblioteca `qrcode`, sem enviar o link a um serviço externo. O pacote CommonJS é permitido explicitamente no builder, restrito ao chunk lazy de configurações.
- Override transitivo `@angular/build → vite 8.3.5`: o builder 22.2.4 fixa Vite 8.3.2, marcado pelo npm audit com vulnerabilidades de dev server. O patch 8.3.5 foi aplicado, com build/testes e audit verificados. Reavaliar ao atualizar Angular CLI; não usar `npm audit fix --force` indiscriminadamente.

## Limites atuais

A agenda Angular inclui lista operacional, calendário agrupado por data em dia/semana/mês, navegação de período, filtros por profissional/status, reagendamento e bloqueios globais ou por profissional. Configurações permite editar timezone e os sete dias de expediente. A grade horária detalhada do React, a paridade completa do onboarding de seis passos, a administração visual de memberships e a validação ampla de acessibilidade permanecem pendentes. Integrações Google/WhatsApp, cobrança sandbox, lembretes externos e validação final de pagamento dependem de homologação. A interface apresenta indisponibilidade explícita e não simula confirmação comercial.
