import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `<main id="conteudo" tabindex="-1" class="landing">
    <header>
      <a routerLink="/" class="sidebar-brand"
        ><img src="/assets/logo-mark.png" width="42" height="42" alt="" /><span class="brand"
          >Agenda<span>Fácil</span></span
        ></a
      ><a routerLink="/login" class="button">Entrar</a>
    </header>
    <section>
      <p class="eyebrow">Agenda para seu negócio</p>
      <h1>Mais tempo para atender.<br />Uma agenda fácil de cuidar.</h1>
      <p>
        Organize profissionais, serviços e clientes. Compartilhe seu link para receber reservas e
        acompanhe os atendimentos em um só lugar.
      </p>
      <div class="form-actions">
        <a class="button primary" routerLink="/register">Criar minha agenda</a
        ><a class="button" routerLink="/login">Já tenho conta</a>
      </div>
      <p class="help">
        Ambiente local de migração. Cobranças e canais de mensagens aguardam homologação.
      </p>
    </section>
  </main>`,
})
export class LandingPage {}
