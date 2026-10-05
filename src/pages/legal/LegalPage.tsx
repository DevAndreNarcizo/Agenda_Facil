import { useEffect } from "react";
import { Link } from "react-router-dom";
import logoMark from "@/assets/logo-mark.png";
import { Icon } from "@/components/panel/primitives";
import { cn } from "@/lib/utils";
import { LEGAL_UPDATED_AT, PRIVACY, TERMS, type LegalDocument } from "./legal-content";

const DOCUMENTS = { termos: TERMS, privacidade: PRIVACY } as const;

/**
 * Página pública de documento legal (Termos de uso ou Política de privacidade) no design system:
 * cabeçalho com marca, alternância entre os dois documentos, índice e texto em coluna de leitura.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function LegalPage({ document: kind }: { document: keyof typeof DOCUMENTS }) {
  const doc: LegalDocument = DOCUMENTS[kind];

  useEffect(() => {
    const previous = window.document.title;
    window.document.title = `${doc.title} · AgendaFácil`;
    return () => {
      window.document.title = previous;
    };
  }, [doc.title]);

  return (
    <div className="af-root min-h-dvh bg-af-bg text-af-ink">
      <header className="border-b border-af-line bg-af-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
          <Link to="/login" className="flex items-center gap-2 rounded-af focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent">
            <img src={logoMark} alt="" width={28} height={28} className="h-7 w-7" />
            <span className="text-[15px] font-bold tracking-[-0.02em]">
              Agenda<span className="text-af-accent">Fácil</span>
            </span>
          </Link>
          <nav aria-label="Documentos legais" className="flex rounded-lg bg-af-surface2 p-0.5 text-[13px]">
            {(Object.keys(DOCUMENTS) as (keyof typeof DOCUMENTS)[]).map((key) => (
              <Link
                key={key}
                to={`/${key}`}
                aria-current={key === kind ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-[5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent",
                  key === kind ? "bg-af-surface font-medium text-af-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-af-ink2 hover:text-af-ink",
                )}
              >
                {key === "termos" ? "Termos" : "Privacidade"}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-af-ink3">Atualizado em {LEGAL_UPDATED_AT}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">{doc.title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-af-ink2 [text-wrap:pretty]">{doc.summary}</p>

        <nav aria-label="Índice" className="mt-8 rounded-af-lg border border-af-line bg-af-surface p-5">
          <p className="mb-3 text-[13px] font-semibold">Nesta página</p>
          <ol className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
            {doc.sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#secao-${index + 1}`} className="text-af-ink2 hover:text-af-accent">{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="mt-10 flex flex-col gap-9">
          {doc.sections.map((section, index) => (
            <section key={section.title} id={`secao-${index + 1}`} className="scroll-mt-6">
              <h2 className="text-lg font-semibold tracking-[-0.01em]">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-[15px] leading-relaxed text-af-ink2 [text-wrap:pretty]">{paragraph}</p>
              ))}
              {section.items && (
                <ul className="mt-3 flex flex-col gap-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-af-ink2">
                      <Icon name="check" size={18} className="mt-0.5 text-af-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <footer className="mt-14 border-t border-af-line pt-6 text-[13px] text-af-ink3">
          <Link to="/login" className="font-medium text-af-accent hover:underline">Voltar para o AgendaFácil</Link>
        </footer>
      </main>
    </div>
  );
}
