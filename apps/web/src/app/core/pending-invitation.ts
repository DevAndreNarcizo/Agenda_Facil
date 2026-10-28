import { Injectable, computed, signal } from '@angular/core';

/** Segredo transitório: trocar de rota preserva o convite; recarregar a SPA o descarta. @author André Narcizo */
@Injectable({ providedIn: 'root' })
export class PendingInvitation {
  private readonly value = signal<string | null>(null);
  readonly available = computed(() => this.value() !== null);

  capture(token: string | null): boolean {
    const valid = token !== null && /^[A-Za-z0-9]{64}$/.test(token);
    this.value.set(valid ? token : null);
    return valid;
  }

  token(): string | null {
    return this.value();
  }

  clear(): void {
    this.value.set(null);
  }
}
