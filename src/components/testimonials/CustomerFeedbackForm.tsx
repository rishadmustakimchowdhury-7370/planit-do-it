import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, Loader2, MessageSquarePlus } from 'lucide-react';

export function CustomerFeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    quote: '',
    author_name: '',
    author_role: '',
    submitted_email: '',
    submitted_company: '',
    rating: 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.quote || !formData.author_name || !formData.author_role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('testimonials').insert({
        quote: formData.quote,
        author_name: formData.author_name,
        author_role: formData.author_role,
        submitted_email: formData.submitted_email || null,
        submitted_company: formData.submitted_company || null,
        rating: formData.rating,
        source: 'customer',
        status: 'pending',
        is_active: false,
        is_featured: false,
        order_index: 999,
      });

      if (error) throw error;

      toast.success('Thank you for your feedback! Your review will be published after approval.');
      setFormData({
        quote: '',
        author_name: '',
        author_role: '',
        submitted_email: '',
        submitted_company: '',
        rating: 5,
      });
      setIsOpen(false);
    } catch (error: any) {
      toast.error('Failed to submit feedback: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          Share Your Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Experience</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Your Review *</Label>
            <Textarea
              value={formData.quote}
              onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
              placeholder="Tell us about your experience with Recruitify CRM..."
              rows={4}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Your Name *</Label>
              <Input
                value={formData.author_name}
                onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <Label>Your Role *</Label>
              <Input
                value={formData.author_role}
                onChange={(e) => setFormData({ ...formData, author_role: e.target.value })}
                placeholder="HR Manager"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Company</Label>
              <Input
                value={formData.submitted_company}
                onChange={(e) => setFormData({ ...formData, submitted_company: e.target.value })}
                placeholder="Company Name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.submitted_email}
                onChange={(e) => setFormData({ ...formData, submitted_email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
          </div>
          
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-7 w-7 cursor-pointer transition-colors ${
                      star <= formData.rating 
                        ? 'fill-warning text-warning' 
                        : 'text-muted hover:text-warning/50'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
