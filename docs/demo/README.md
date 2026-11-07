# Demonstração — como ver e testar

Dados 100% **sintéticos** (DemoSeeder). Screenshots em `docs/demo/screens/` (geradas por `scripts/demo/capture.sh`).

## Rodar localmente (recomendado para testar)

Requisitos: PHP 8.4 + Composer, Node 22.

```bash
./scripts/demo/run-local.sh
```

Sobe o Laravel em `:8000` (SQLite efêmero + DemoSeeder) e o Angular em `:4200`. Abra http://localhost:4200.

| O quê | Como |
|---|---|
| Painel (dono) | `demo@agendafacil.example` / `demo-staging-123` |
| Reserva pública | http://localhost:4200/reservar/studio-demo |
| OTP da reserva | telefone `11988887777`; o código aparece na tela (ambiente local) |
| Cadastro novo | http://localhost:4200/register (ganha trial automático no Starter) |

Cobrança e WhatsApp usam provedores **fake** (sem credenciais externas).

## Telas

`01-login`, `02-dashboard`, `03-agenda`, `04-clientes`, `05-servicos`, `06-profissionais`, `07-analytics`, `08-configuracoes`, `09-assinatura`, `10-planos`, `11-reserva-publica-desktop`, `12-reserva-publica-mobile`.
