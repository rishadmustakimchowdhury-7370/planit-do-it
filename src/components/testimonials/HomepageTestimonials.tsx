import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
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
  show_company?: boolean | null;
}

function TestimonialCard({ t }: { t: Testimonial }) {
  const showCompany = t.show_company === true; // default hidden
  return (
    <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 group">
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
              {showCompany && t.author_role && t.submitted_company ? ' · ' : ''}
              {showCompany ? t.submitted_company : ''}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HomepageTestimonials() {
  const { data, isLoading } = useQuery({
    queryKey: ['homepage-testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('id, quote, author_name, author_role, submitted_company, author_avatar, rating, show_company')
        .eq('is_active', true)
        .eq('status', 'approved')
        .order('order_index', { ascending: true })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as Testimonial[];
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const testimonials = useMemo(() => (data ?? []).slice(0, 12), [data]);

  const autoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', dragFree: false, slidesToScroll: 1 },
    [autoplay.current]
  );

  const [, setSelected] = useState(0);
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12 md:mb-16"
        >
          <h2 className="text-3xl md:text-[44px] font-bold tracking-tight leading-tight">
            Trusted By Recruitment Professionals
          </h2>
          <p className="text-muted-foreground mt-4">
            See how recruiters and agency leaders are using HireMetrics to streamline submissions, placements and revenue tracking.
          </p>
        </motion.div>

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex -ml-4 lg:-ml-6">
              {testimonials.map((t) => (
                <div
                  key={t.id}
                  className="flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] pl-4 lg:pl-6 min-w-0"
                >
                  <TestimonialCard t={t} />
                </div>
              ))}
            </div>
          </div>

          {testimonials.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => emblaApi?.scrollPrev()}
                className="rounded-full h-10 w-10"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => emblaApi?.scrollNext()}
                className="rounded-full h-10 w-10"
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
