import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, BRAND } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { ChevronRight, Printer } from 'lucide-react';

export interface TocSection {
  id: string;
  label: string;
}

interface Props {
  breadcrumb: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  seo: {
    title: string;
    description: string;
    canonical: string;
    ogType?: string;
    jsonLd?: Record<string, unknown>;
  };
  toc: TocSection[];
  children: ReactNode;
}

/**
 * Shared marketing/legal layout: hero, breadcrumb, sticky table of contents,
 * reading-width prose column, print-friendly.
 * SEO tags are written into document.head via effect so per-page metadata
 * updates without introducing a new dependency (react-helmet-async).
 */
export function LegalPageLayout({
  breadcrumb,
  title,
  subtitle,
  lastUpdated,
  seo,
  toc,
  children,
}: Props) {
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? '');

  // ---- Head metadata --------------------------------------------------------
  useEffect(() => {
    const previousTitle = document.title;
    document.title = seo.title;

    const setMeta = (attr: 'name' | 'property', key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(
        `meta[${attr}="${key}"]`,
      );
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
      return el;
    };

    const setLink = (rel: string, href: string) => {
      let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
      return el;
    };

    setMeta('name', 'description', seo.description);
    setMeta('property', 'og:title', seo.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:type', seo.ogType ?? 'article');
    setMeta('property', 'og:url', seo.canonical);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', seo.title);
    setMeta('name', 'twitter:description', seo.description);
    setLink('canonical', seo.canonical);

    let script: HTMLScriptElement | null = null;
    if (seo.jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(seo.jsonLd);
      script.setAttribute('data-legal-page', seo.canonical);
      document.head.appendChild(script);
    }

    return () => {
      document.title = previousTitle;
      if (script) script.remove();
    };
  }, [seo]);

  // ---- TOC scroll spy -------------------------------------------------------
  const ids = useMemo(() => toc.map((s) => s.id), [toc]);
  useEffect(() => {
    if (ids.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0.1 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Marketing header */}
      <header className="border-b border-border py-4 px-6 print:hidden">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/" aria-label={`${BRAND.name} home`}>
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/auth" className="hidden sm:inline-flex">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-muted/30 print:bg-white print:border-0">
        <div className="container mx-auto max-w-6xl px-6 py-12 md:py-16">
          <nav aria-label="Breadcrumb" className="mb-6 print:hidden">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li className="text-foreground font-medium" aria-current="page">
                {breadcrumb}
              </li>
            </ol>
          </nav>
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">Last updated:</span>{' '}
                {lastUpdated}
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors print:hidden"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                Print this page
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-12">
          {/* TOC — sticky on desktop */}
          {toc.length > 0 && (
            <aside className="hidden lg:block print:hidden">
              <div className="sticky top-8">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                  On this page
                </p>
                <nav aria-label="Table of contents">
                  <ul className="space-y-1.5 border-l border-border">
                    {toc.map((s) => {
                      const active = s.id === activeId;
                      return (
                        <li key={s.id}>
                          <a
                            href={`#${s.id}`}
                            className={`block -ml-px pl-4 py-1 text-sm border-l-2 transition-colors ${
                              active
                                ? 'border-primary text-foreground font-medium'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                            }`}
                          >
                            {s.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            </aside>
          )}

          {/* Main content */}
          <main className="min-w-0 max-w-3xl">{children}</main>
        </div>
      </div>

      {/* Footer note */}
      <footer className="border-t border-border py-8 px-6 print:hidden">
        <div className="container mx-auto max-w-6xl text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Content primitives (shared across legal pages, CMS-friendly)              */
/* -------------------------------------------------------------------------- */

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 mb-14 last:mb-0"
      aria-labelledby={`${id}-heading`}
    >
      <h2
        id={`${id}-heading`}
        className="text-2xl md:text-[1.75rem] font-semibold tracking-tight text-foreground mb-5 scroll-mt-24"
      >
        {title}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-foreground mt-8 mb-3">{children}</h3>
  );
}

export function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: 'info' | 'warning' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: 'border-primary/25 bg-primary/[0.04] text-foreground',
    warning: 'border-warning/40 bg-warning/[0.06] text-foreground',
    success: 'border-success/40 bg-success/[0.06] text-foreground',
  }[variant];

  return (
    <div className={`rounded-xl border ${styles} p-5 my-6`} role="note">
      {title && (
        <p className="font-semibold text-foreground mb-1.5 text-sm">{title}</p>
      )}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function InlineList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 space-y-2 marker:text-muted-foreground/50">
      {items.map((item, i) => (
        <li key={i} className="text-[15px] leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}
