import * as React from "react";
import { Icon } from "@/components/panel/primitives";
import { cn } from "@/lib/utils";

export interface ListColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

/**
 * Tabela em grid do painel: cabeçalho rebaixado, linhas com hover e rolagem horizontal
 * abaixo de `minWidth` (telefones e datas nunca quebram no meio).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ListTable<T>({ columns, template, rows, rowKey, minWidth = 720, loading, empty, footer, onRowClick }: {
  columns: ListColumn<T>[];
  /** grid-template-columns compartilhado entre cabeçalho e linhas. */
  template: string;
  rows: T[];
  rowKey: (row: T) => string;
  minWidth?: number;
  loading?: boolean;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <section className="overflow-hidden rounded-af-lg border border-af-line bg-af-surface">
      <div className="overflow-x-auto">
        <div role="table" style={{ minWidth }}>
          <div role="row" className="grid items-center gap-4 border-b border-af-line bg-af-surface2 px-5 py-2.5" style={{ gridTemplateColumns: template }}>
            {columns.map((column) => (
              <span key={column.key} role="columnheader" className={cn("text-xs font-medium text-af-ink2", column.align === "right" && "text-right")}>
                {column.header}
              </span>
            ))}
          </div>
          {loading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="border-t border-af-line px-5 py-3 first:border-t-0">
                <div className="h-8 animate-pulse rounded-lg bg-af-surface2" />
              </div>
            ))
          ) : rows.length === 0 ? (
            empty
          ) : (
            rows.map((row) => (
              <div
                key={rowKey(row)}
                role="row"
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("grid items-center gap-4 border-t border-af-line px-5 py-3 first:border-t-0 hover:bg-af-surface2", onRowClick && "cursor-pointer")}
                style={{ gridTemplateColumns: template }}
              >
                {columns.map((column) => (
                  <div key={column.key} role="cell" className={cn("min-w-0", column.align === "right" && "flex justify-end text-right")}>
                    {column.render(row)}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-af-line px-5 py-3 text-[13px] text-af-ink2">{footer}</div>}
    </section>
  );
}

/**
 * Paginação compacta com reticências (1 2 3 … 18).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === pageCount || Math.abs(candidate - page) <= 1,
  );

  return (
    <nav aria-label="Paginação" className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex rounded-md border border-af-line p-[5px] text-af-ink2 hover:bg-af-surface2 disabled:opacity-45"
      >
        <Icon name="chevron_left" size={18} />
      </button>
      {pages.map((candidate, index) => (
        <React.Fragment key={candidate}>
          {index > 0 && pages[index - 1] !== candidate - 1 && <span className="px-1.5 text-af-ink3">…</span>}
          <button
            type="button"
            aria-current={candidate === page ? "page" : undefined}
            onClick={() => onChange(candidate)}
            className={cn("rounded-md px-2.5 py-1", candidate === page ? "bg-af-surface2 font-medium text-af-ink" : "hover:bg-af-surface2")}
          >
            {candidate}
          </button>
        </React.Fragment>
      ))}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="flex rounded-md border border-af-line p-[5px] text-af-ink2 hover:bg-af-surface2 disabled:opacity-45"
      >
        <Icon name="chevron_right" size={18} />
      </button>
    </nav>
  );
}

/**
 * Célula primária da lista: avatar/ícone, nome e linha secundária truncada.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ListPrimaryCell({ leading, title, subtitle }: { leading: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-af-ink">{title}</span>
        {subtitle && <span className="truncate text-xs text-af-ink3">{subtitle}</span>}
      </div>
    </div>
  );
}
