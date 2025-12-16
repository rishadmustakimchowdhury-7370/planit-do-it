import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Star, Loader2, Quote, GripVertical, CheckCircle, XCircle, Clock, Users, Building } from 'lucide-react';

interface Testimonial {
  id: string;
  quote: string;
  author_name: string;
  author_role: string;
  author_avatar: string | null;
  rating: number;
  is_featured: boolean;
  is_active: boolean;
  order_index: number;
  source: string;
  status: string;
  submitted_email: string | null;
  submitted_company: string | null;
  created_at: string;
}

export default function AdminTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const [formData, setFormData] = useState({
    quote: '',
    author_name: '',
    author_role: '',
    author_avatar: '',
    rating: 5,
    is_featured: false,
    is_active: true,
    order_index: 0,
    status: 'approved',
  });

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTestimonials(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch testimonials: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (testimonial?: Testimonial) => {
    if (testimonial) {
      setEditingTestimonial(testimonial);
      setFormData({
        quote: testimonial.quote,
        author_name: testimonial.author_name,
        author_role: testimonial.author_role,
        author_avatar: testimonial.author_avatar || '',
        rating: testimonial.rating,
        is_featured: testimonial.is_featured,
        is_active: testimonial.is_active,
        order_index: testimonial.order_index,
        status: testimonial.status || 'approved',
      });
    } else {
      setEditingTestimonial(null);
      setFormData({
        quote: '',
        author_name: '',
        author_role: '',
        author_avatar: '',
        rating: 5,
        is_featured: false,
        is_active: true,
        order_index: testimonials.length,
        status: 'approved',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.quote || !formData.author_name || !formData.author_role) {
      toast.error('Quote, author name, and role are required');
      return;
    }

    setSaving(true);
    try {
      const testimonialData = {
        quote: formData.quote,
        author_name: formData.author_name,
        author_role: formData.author_role,
        author_avatar: formData.author_avatar || null,
        rating: formData.rating,
        is_featured: formData.is_featured,
        is_active: formData.is_active,
        order_index: formData.order_index,
        status: formData.status,
        source: editingTestimonial?.source || 'admin',
      };

      if (editingTestimonial) {
        const { error } = await supabase
          .from('testimonials')
          .update(testimonialData)
          .eq('id', editingTestimonial.id);
        if (error) throw error;
        toast.success('Testimonial updated');
      } else {
        const { error } = await supabase
          .from('testimonials')
          .insert(testimonialData);
        if (error) throw error;
        toast.success('Testimonial created');
      }

      setIsDialogOpen(false);
      fetchTestimonials();
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;

    try {
      const { error } = await supabase.from('testimonials').delete().eq('id', id);
      if (error) throw error;
      toast.success('Testimonial deleted');
      fetchTestimonials();
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const handleApprove = async (testimonial: Testimonial) => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({ status: 'approved', is_active: true })
        .eq('id', testimonial.id);
      if (error) throw error;
      toast.success('Testimonial approved and published');
      fetchTestimonials();
    } catch (error: any) {
      toast.error('Failed to approve: ' + error.message);
    }
  };

  const handleReject = async (testimonial: Testimonial) => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({ status: 'rejected', is_active: false })
        .eq('id', testimonial.id);
      if (error) throw error;
      toast.success('Testimonial rejected');
      fetchTestimonials();
    } catch (error: any) {
      toast.error('Failed to reject: ' + error.message);
    }
  };

  const toggleActive = async (testimonial: Testimonial) => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({ is_active: !testimonial.is_active })
        .eq('id', testimonial.id);
      if (error) throw error;
      fetchTestimonials();
    } catch (error: any) {
      toast.error('Failed to update: ' + error.message);
    }
  };

  const filteredTestimonials = testimonials.filter((t) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return t.status === 'pending';
    if (activeTab === 'approved') return t.status === 'approved';
    if (activeTab === 'customer') return t.source === 'customer';
    if (activeTab === 'admin') return t.source === 'admin';
    return true;
  });

  const pendingCount = testimonials.filter((t) => t.status === 'pending').length;
  const customerCount = testimonials.filter((t) => t.source === 'customer').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success/10 text-success border-success/20">Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'customer':
        return <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" /> Customer</Badge>;
      case 'admin':
        return <Badge variant="outline" className="gap-1"><Building className="h-3 w-3" /> Admin</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  return (
    <AdminLayout title="Testimonials" description="Manage homepage testimonials and customer feedback">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{testimonials.length}</div>
              <div className="text-sm text-muted-foreground">Total Reviews</div>
            </CardContent>
          </Card>
          <Card className={pendingCount > 0 ? 'border-warning' : ''}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-warning">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending Approval</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{customerCount}</div>
              <div className="text-sm text-muted-foreground">Customer Submitted</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{testimonials.filter((t) => t.is_active).length}</div>
              <div className="text-sm text-muted-foreground">Published</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending" className="gap-1">
                Pending {pendingCount > 0 && <Badge variant="secondary" className="h-5 w-5 p-0 justify-center">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="customer">Customer</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Testimonial
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTestimonials.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Quote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No testimonials found</h3>
              <p className="text-muted-foreground mb-4">
                {activeTab === 'pending' ? 'No pending reviews to approve' : 'Add your first customer testimonial'}
              </p>
              {activeTab === 'all' && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Testimonial
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTestimonials.map((testimonial) => (
              <Card key={testimonial.id} className={!testimonial.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="cursor-move hidden sm:block">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    {testimonial.author_avatar && (
                      <img
                        src={testimonial.author_avatar}
                        alt={testimonial.author_name}
                        className="w-12 h-12 rounded-full object-cover hidden sm:block"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < testimonial.rating ? 'fill-warning text-warning' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                        {getStatusBadge(testimonial.status)}
                        {getSourceBadge(testimonial.source)}
                        {testimonial.is_featured && <Badge variant="secondary">Featured</Badge>}
                        {!testimonial.is_active && <Badge variant="outline">Inactive</Badge>}
                      </div>
                      <p className="text-foreground mb-2 line-clamp-2">"{testimonial.quote}"</p>
                      <p className="text-sm font-medium">{testimonial.author_name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.author_role}</p>
                      {testimonial.source === 'customer' && (
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          {testimonial.submitted_email && <div>Email: {testimonial.submitted_email}</div>}
                          {testimonial.submitted_company && <div>Company: {testimonial.submitted_company}</div>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      {testimonial.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(testimonial)}
                            className="text-success hover:text-success gap-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(testimonial)}
                            className="text-destructive hover:text-destructive gap-1"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Switch
                        checked={testimonial.is_active}
                        onCheckedChange={() => toggleActive(testimonial)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(testimonial)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(testimonial.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label>Quote *</Label>
              <Textarea
                value={formData.quote}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                placeholder="Enter the testimonial quote..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Author Name *</Label>
                <Input
                  value={formData.author_name}
                  onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label>Author Role *</Label>
                <Input
                  value={formData.author_role}
                  onChange={(e) => setFormData({ ...formData, author_role: e.target.value })}
                  placeholder="CEO, Company Inc."
                />
              </div>
            </div>
            <div>
              <Label>Author Avatar URL</Label>
              <Input
                value={formData.author_avatar}
                onChange={(e) => setFormData({ ...formData, author_avatar: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rating (1-5)</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                    >
                      <Star
                        className={`h-6 w-6 cursor-pointer ${star <= formData.rating ? 'fill-warning text-warning' : 'text-muted'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                />
                <Label>Featured</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTestimonial ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
