import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Casca das telas públicas/de acesso: marca no topo e conteúdo em coluna de 440px
 * (cartão com borda a partir de 640px; no celular o conteúdo fica direto sobre o fundo).
 */
@Component({
  selector: 'af-auth-shell',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-root">
      <main class="auth-main" [class.wide]="wide()">
        <header class="auth-head">
          <a routerLink="/login" aria-label="AgendaFácil"><img src="/logo-mark.png" alt="" width="64" height="64" /></a>
          <span class="brand">Agenda<b>Fácil</b></span>
          @if (lead()) {
            <p>{{ lead() }}</p>
          }
        </header>
        <div class="auth-card"><ng-content /></div>
      </main>
    </div>
  `,
})
export class AuthShellComponent {
  readonly lead = input('');
  readonly wide = input(false);
}
