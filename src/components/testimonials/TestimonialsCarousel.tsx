import { useEffect, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface Testimonial {
  id: string;
  quote: string;
  author_name: string;
  author_role: string;
  author_avatar: string | null;
  rating: number | null;
}

const defaultTestimonials: Testimonial[] = [
  {
    id: '1',
    quote: "HireMetrics cut our time-to-hire by 60%. The AI matching is incredibly accurate.",
    author_name: "Sarah Johnson",
    author_role: "Head of Talent, TechCorp",
    author_avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    rating: 5,
  },
  {
    id: '2',
    quote: "Finally, a recruitment tool that actually understands what we're looking for.",
    author_name: "Michael Chen",
    author_role: "CEO, Fintech Innovations",
    author_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 5,
  },
  {
    id: '3',
    quote: "The pipeline visualization changed how our team collaborates on hiring.",
    author_name: "Emily Davis",
    author_role: "HR Director, HealthTech Pro",
    author_avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    rating: 5,
  },
];

export function TestimonialsCarousel() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(defaultTestimonials);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    slidesToScroll: 1,
    breakpoints: {
      '(min-width: 640px)': { slidesToScroll: 2 },
      '(min-width: 1024px)': { slidesToScroll: 3 },
    },
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    const fetchTestimonials = async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('id, quote, author_name, author_role, author_avatar, rating')
        .eq('is_active', true)
        .eq('status', 'approved')
        .order('order_index', { ascending: true });

      if (!error && data && data.length > 0) {
        setTestimonials(data);
      }
    };

    fetchTestimonials();
  }, []);

  return (
    <div className="relative">
      {/* Navigation Buttons */}
      <div className="absolute -left-4 sm:-left-12 top-1/2 -translate-y-1/2 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          className="rounded-full shadow-md bg-background/80 backdrop-blur-sm h-10 w-10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute -right-4 sm:-right-12 top-1/2 -translate-y-1/2 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={scrollNext}
          disabled={!canScrollNext}
          className="rounded-full shadow-md bg-background/80 backdrop-blur-sm h-10 w-10"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-4">
          {testimonials.map((testimonial, i) => (
            <div
              key={testimonial.id}
              className="flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] pl-4 min-w-0"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: Math.min(i * 0.1, 0.3) }}
                viewport={{ once: true }}
              >
                <Card className="h-full">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex gap-1 mb-3 sm:mb-4">
                      {[...Array(testimonial.rating || 5)].map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-sm sm:text-base text-foreground mb-4 sm:mb-6 line-clamp-4">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center gap-3">
                      <img
                        src={testimonial.author_avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'}
                        alt={testimonial.author_name}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium text-sm sm:text-base">{testimonial.author_name}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">{testimonial.author_role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator for many testimonials */}
      {testimonials.length > 3 && (
        <div className="flex justify-center mt-6 gap-2">
          <span className="text-sm text-muted-foreground">
            Scroll to see {testimonials.length} reviews
          </span>
        </div>
      )}
    </div>
  );
}
