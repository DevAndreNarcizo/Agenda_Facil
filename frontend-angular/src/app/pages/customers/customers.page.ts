import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomersService } from '../../core/services/customers.service';

/**
 * Clientes: busca e cadastro. Qualquer membro da equipe pode usar.
 */
@Component({
  selector: 'af-customers',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './customers.page.html',
})
export class CustomersPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly customers = inject(CustomersService);

  readonly saving = signal(false);
  readonly search = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    phone: [''],
    email: ['', [Validators.email]],
  });

  async ngOnInit(): Promise<void> {
    await this.customers.load();
  }

  async doSearch(value: string): Promise<void> {
    this.search.set(value);
    await this.customers.load(value);
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      await this.customers.create({
        name: v.name,
        phone: v.phone || undefined,
        email: v.email || undefined,
      });
      this.form.reset({ name: '', phone: '', email: '' });
    } finally {
      this.saving.set(false);
    }
  }
}
