import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `<main id="conteudo" tabindex="-1" class="auth-page">
    <section class="auth-card">
      <a routerLink="/" class="brand">Agenda<span>Fácil</span></a>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <a routerLink="/dashboard" class="button primary">Voltar ao painel</a
      ><a routerLink="/login">Entrar</a>
    </section>
  </main>`,
})
export class StatusPage {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] ?? 'Página não encontrada';
  readonly description =
    this.route.snapshot.data['description'] ?? 'Confira o endereço ou volte ao painel.';
}
