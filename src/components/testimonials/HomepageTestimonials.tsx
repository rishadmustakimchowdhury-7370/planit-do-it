import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Testimonial {
  id: string;
  quote: string;
  author_name: string;
  author_role: string | null;
  submitted_company: string | null;
  author_avatar: string | null;
  rating: number | null;
}

function track(event: 'testimonial_view' | 'testimonial_click', payload: Record<string, unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w.gtag === 'function') w.gtag('event', event, payload);
    if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event, ...payload });
  } catch {
    /* no-op */
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function TestimonialCard({ t, index }: { t: Testimonial; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3) }}
      onViewportEnter={() => track('testimonial_view', { id: t.id })}
      className="h-full"
    >
      <Card
        onClick={() => track('testimonial_click', { id: t.id })}
        className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 cursor-default group"
      >
        <CardContent className="p-6 sm:p-7 flex flex-col h-full">
          <Quote className="h-7 w-7 text-primary/30 mb-3 group-hover:text-primary/50 transition-colors" />
          <div className="flex gap-1 mb-4">
            {[...Array(t.rating || 5)].map((_, j) => (
              <Star key={j} className="h-4 w-4 fill-warning text-warning" />
            ))}
          </div>
          <p className="text-sm sm:text-base text-foreground leading-relaxed mb-6 flex-1">
            "{t.quote}"
          </p>
          <div className="flex items-center gap-3 pt-4 border-t border-border/60">
            {t.author_avatar ? (
              <img
                src={t.author_avatar}
                alt={t.author_name}
                loading="lazy"
                className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/10"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {t.author_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{t.author_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {t.author_role}
                {t.author_role && t.author_company ? ' · ' : ''}
                {t.author_company}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function HomepageTestimonials() {
  const { data, isLoading } = useQuery({
    queryKey: ['homepage-testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('id, quote, author_name, author_role, author_company, author_avatar, rating')
        .eq('is_active', true)
        .eq('status', 'approved')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Testimonial[];
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const testimonials = useMemo(() => {
    const list = data ?? [];
    if (list.length <= 6) return list;
    return shuffle(list).slice(0, 6);
  }, [data]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);
  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect).on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (isLoading || testimonials.length === 0) return null;

  return (
    <section className="py-20 md:py-28 px-5 sm:px-6 bg-muted/30 border-y border-border/60">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-[44px] font-bold tracking-tight leading-tight">
            Trusted By Recruitment Professionals
          </h2>
          <p className="text-muted-foreground mt-4">
            See what recruiters, agency owners and hiring professionals say about HireMetrics.
          </p>
        </div>

        {/* Desktop / Tablet grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <TestimonialCard key={t.id} t={t} index={i} />
          ))}
        </div>

        {/* Mobile carousel */}
        <div className="sm:hidden">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex -ml-4">
              {testimonials.map((t, i) => (
                <div key={t.id} className="flex-[0_0_100%] pl-4 min-w-0">
                  <TestimonialCard t={t} index={i} />
                </div>
              ))}
            </div>
          </div>
          {testimonials.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="icon"
                onClick={() => emblaApi?.scrollPrev()}
                disabled={!canPrev}
                className="rounded-full h-9 w-9"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => emblaApi?.scrollNext()}
                disabled={!canNext}
                className="rounded-full h-9 w-9"
                aria-label="Next testimonial"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
