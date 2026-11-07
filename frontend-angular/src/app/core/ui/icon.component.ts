import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Ícone Material Symbols (fonte local, subconjunto do app React). Use apenas nomes presentes
 * em `src/lib/material-icons.ts` do app React — a fonte contém exatamente esses glifos.
 */
@Component({
  selector: 'af-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: inline-flex; line-height: 0;' },
  template: `<span class="icon" [class.fill]="fill()" [style.font-size.px]="size()" aria-hidden="true">{{ name() }}</span>`,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly fill = input(false);
}
