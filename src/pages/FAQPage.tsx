import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, BRAND } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ChevronRight, Search, LifeBuoy, Mail } from 'lucide-react';
import { faqCategories, faqItems, type FaqCategoryId } from '@/content/faq';

const CANONICAL = 'https://hiremetrics.co.uk/faq';

export default function FAQPage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FaqCategoryId | 'all'>(
    'all',
  );

  // ---- SEO / structured data -----------------------------------------------
  useEffect(() => {
    const prevTitle = document.title;
    const title = `FAQ — Frequently Asked Questions | ${BRAND.name}`;
    const description = `Answers to common questions about ${BRAND.name} — pricing, AI candidate discovery, integrations (Apollo, Lusha, Vibe), billing, security, and multi-tenant data handling.`;

    document.title = title;

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
    };
    const setLink = (rel: string, href: string) => {
      let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', CANONICAL);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setLink('canonical', CANONICAL);

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-faq-jsonld', 'true');
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    });
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      script.remove();
    };
  }, []);

  // ---- Filtering -----------------------------------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqItems.filter((f) => {
      if (activeCategory !== 'all' && f.category !== activeCategory) return false;
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<FaqCategoryId, typeof faqItems>();
    for (const f of filtered) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      {/* Marketing header */}
      <header className="border-b border-border py-4 px-6">
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
      <section className="border-b border-border bg-muted/30">
        <div className="container mx-auto max-w-6xl px-6 py-12 md:py-16">
          <nav aria-label="Breadcrumb" className="mb-6">
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
                FAQ
              </li>
            </ol>
          </nav>
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Frequently asked questions
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Everything you need to know about the {BRAND.name} platform —
              pricing, sourcing, integrations, security and support. Can't find
              what you're looking for? Our team responds in one business day.
            </p>

            {/* Search */}
            <div className="mt-8 relative max-w-2xl">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions… e.g. cancel subscription, Apollo, GDPR"
                className="pl-11 h-12 text-base bg-background border-border"
                aria-label="Search frequently asked questions"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-12">
          {/* Category rail */}
          <aside className="lg:block">
            <div className="lg:sticky lg:top-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Categories
              </p>
              <nav aria-label="FAQ categories">
                <ul className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('all')}
                      className={`whitespace-nowrap text-left px-3 py-2 rounded-md text-sm w-full transition-colors ${
                        activeCategory === 'all'
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      All questions
                      <Badge
                        variant="secondary"
                        className="ml-2 h-5 text-[10px]"
                      >
                        {faqItems.length}
                      </Badge>
                    </button>
                  </li>
                  {faqCategories.map((cat) => {
                    const count = faqItems.filter(
                      (f) => f.category === cat.id,
                    ).length;
                    const active = activeCategory === cat.id;
                    return (
                      <li key={cat.id}>
                        <button
                          type="button"
                          onClick={() => setActiveCategory(cat.id)}
                          className={`whitespace-nowrap text-left px-3 py-2 rounded-md text-sm w-full transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {cat.label}
                          <Badge
                            variant="secondary"
                            className="ml-2 h-5 text-[10px]"
                          >
                            {count}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </aside>

          {/* Q&A */}
          <main className="min-w-0">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <LifeBuoy className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <h2 className="text-lg font-semibold">No matching questions</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different search term or reset the category filter.
                </p>
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setQuery('');
                    setActiveCategory('all');
                  }}
                >
                  Reset filters
                </Button>
              </div>
            ) : (
              <div className="space-y-12">
                {faqCategories
                  .filter((c) => grouped.has(c.id))
                  .map((cat) => {
                    const items = grouped.get(cat.id) ?? [];
                    return (
                      <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
                        <div className="mb-4">
                          <h2
                            id={`cat-${cat.id}`}
                            className="text-xl font-semibold tracking-tight text-foreground"
                          >
                            {cat.label}
                          </h2>
                          {cat.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {cat.description}
                            </p>
                          )}
                        </div>
                        <Accordion
                          type="single"
                          collapsible
                          className="border border-border rounded-xl divide-y divide-border bg-card"
                        >
                          {items.map((f, i) => (
                            <AccordionItem
                              key={f.question}
                              value={`${cat.id}-${i}`}
                              className="border-0 px-5"
                            >
                              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                                {f.question}
                              </AccordionTrigger>
                              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground pb-5 whitespace-pre-line">
                                {f.answer}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </section>
                    );
                  })}
              </div>
            )}

            {/* Help CTA */}
            <div className="mt-14 rounded-2xl border border-border bg-muted/40 p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Still have questions?
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Our recruitment success team responds to every inbound message
                  within one business day.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild variant="outline">
                  <a href={`mailto:${BRAND.email}`}>
                    <Mail className="w-4 h-4" />
                    Email support
                  </a>
                </Button>
                <Button asChild>
                  <Link to="/contact">Contact sales</Link>
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>

      <footer className="border-t border-border py-8 px-6">
        <div className="container mx-auto max-w-6xl text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
