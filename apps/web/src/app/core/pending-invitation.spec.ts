import { TestBed } from '@angular/core/testing';
import { PendingInvitation } from './pending-invitation';

describe('convite pendente em memória', () => {
  it('mantém segredo somente na instância da SPA e descarta captura inválida', () => {
    const persisted = vi.spyOn(Storage.prototype, 'setItem');
    const pending = TestBed.inject(PendingInvitation);
    expect(pending.capture('a'.repeat(64))).toBe(true);
    expect(pending.available()).toBe(true);
    expect(pending.token()).toBe('a'.repeat(64));
    expect(persisted).not.toHaveBeenCalled();
    expect(new PendingInvitation().available()).toBe(false);
    expect(pending.capture('invalid')).toBe(false);
    expect(pending.token()).toBeNull();
    pending.capture('b'.repeat(64));
    pending.clear();
    expect(pending.available()).toBe(false);
    persisted.mockRestore();
  });
});
