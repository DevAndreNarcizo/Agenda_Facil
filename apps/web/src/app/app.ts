import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template:
    '<a class="skip-link" href="#conteudo" (click)="skip($event)">Pular para o conteúdo</a><router-outlet />',
})
export class App {
  private readonly document = inject(DOCUMENT);
  skip(event: Event): void {
    event.preventDefault();
    this.document.getElementById('conteudo')?.focus();
  }
  /** Move o foco para o conteúdo novo depois da renderização da rota. @author André Narcizo */
  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        requestAnimationFrame(() => {
          const heading = this.document.querySelector<HTMLElement>('main h1');
          const target = heading ?? this.document.getElementById('conteudo');
          if (!target) return;
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        });
      });
  }
}
