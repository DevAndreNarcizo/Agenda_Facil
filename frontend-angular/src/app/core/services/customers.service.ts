import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Customer } from '../models';

/**
 * Clientes da organização (list/busca + cadastro). Consome a API Laravel.
 */
@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly _customers = signal<Customer[]>([]);
  readonly customers = this._customers.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async load(query = ''): Promise<void> {
    const url = query
      ? `${environment.apiBaseUrl}/customers?q=${encodeURIComponent(query)}`
      : `${environment.apiBaseUrl}/customers`;
    const res = await firstValueFrom(this.http.get<{ data: Customer[] }>(url));
    this._customers.set(res.data);
  }

  async create(input: { name: string; phone?: string; email?: string; notes?: string }): Promise<Customer> {
    const res = await firstValueFrom(
      this.http.post<{ data: Customer }>(`${environment.apiBaseUrl}/customers`, input),
    );
    await this.load();
    return res.data;
  }
}
