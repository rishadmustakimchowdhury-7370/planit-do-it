import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, Loader2, MessageSquarePlus, Upload, User } from 'lucide-react';

export function CustomerFeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    quote: '',
    author_name: '',
    author_role: '',
    submitted_email: '',
    submitted_company: '',
    rating: 5,
    author_avatar: '',
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);

      // Upload to Supabase
      const fileName = `testimonials/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      setFormData({ ...formData, author_avatar: urlData.publicUrl });
      toast.success('Photo uploaded');
    } catch (error: any) {
      toast.error('Failed to upload: ' + error.message);
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

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
        author_avatar: formData.author_avatar || null,
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
        author_avatar: '',
      });
      setAvatarPreview(null);
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
          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20 border-2 border-dashed border-border">
              <AvatarImage src={avatarPreview || formData.author_avatar} />
              <AvatarFallback>
                <User className="h-8 w-8 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload Photo
            </Button>
          </div>

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
            <Button type="submit" disabled={isSubmitting || uploading} className="flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
