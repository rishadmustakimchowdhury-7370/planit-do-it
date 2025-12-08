import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  content: any;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<CMSPage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    meta_title: '',
    meta_description: '',
    is_published: false,
  });

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from('cms_pages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPages(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch pages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (page?: CMSPage) => {
    if (page) {
      setEditingPage(page);
      setFormData({
        title: page.title,
        slug: page.slug,
        content: typeof page.content === 'string' ? page.content : JSON.stringify(page.content, null, 2),
        meta_title: page.meta_title || '',
        meta_description: page.meta_description || '',
        is_published: page.is_published,
      });
    } else {
      setEditingPage(null);
      setFormData({
        title: '',
        slug: '',
        content: '',
        meta_title: '',
        meta_description: '',
        is_published: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) {
      toast.error('Title and slug are required');
      return;
    }

    setSaving(true);
    try {
      const pageData = {
        title: formData.title,
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        content: { body: formData.content },
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        is_published: formData.is_published,
        published_at: formData.is_published ? new Date().toISOString() : null,
      };

      if (editingPage) {
        const { error } = await supabase
          .from('cms_pages')
          .update(pageData)
          .eq('id', editingPage.id);
        if (error) throw error;
        toast.success('Page updated successfully');
      } else {
        const { error } = await supabase
          .from('cms_pages')
          .insert(pageData);
        if (error) throw error;
        toast.success('Page created successfully');
      }

      setIsDialogOpen(false);
      fetchPages();
    } catch (error: any) {
      toast.error('Failed to save page: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const { error } = await supabase.from('cms_pages').delete().eq('id', id);
      if (error) throw error;
      toast.success('Page deleted successfully');
      fetchPages();
    } catch (error: any) {
      toast.error('Failed to delete page: ' + error.message);
    }
  };

  const togglePublish = async (page: CMSPage) => {
    try {
      const { error } = await supabase
        .from('cms_pages')
        .update({
          is_published: !page.is_published,
          published_at: !page.is_published ? new Date().toISOString() : null,
        })
        .eq('id', page.id);

      if (error) throw error;
      toast.success(page.is_published ? 'Page unpublished' : 'Page published');
      fetchPages();
    } catch (error: any) {
      toast.error('Failed to update page: ' + error.message);
    }
  };

  return (
    <AdminLayout title="CMS Pages" description="Manage public website pages">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Create and manage static pages for your public website</p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Page
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPage ? 'Edit Page' : 'Create New Page'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Page Title"
                    />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="page-slug"
                    />
                  </div>
                </div>
                <div>
                  <Label>Content (HTML)</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="<h1>Hello World</h1>"
                    rows={10}
                  />
                </div>
                <div>
                  <Label>Meta Title (SEO)</Label>
                  <Input
                    value={formData.meta_title}
                    onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                    placeholder="SEO Title"
                  />
                </div>
                <div>
                  <Label>Meta Description (SEO)</Label>
                  <Textarea
                    value={formData.meta_description}
                    onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                    placeholder="SEO Description"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <Label>Publish immediately</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingPage ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : pages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No pages yet</h3>
              <p className="text-muted-foreground mb-4">Create your first CMS page</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pages.map((page) => (
              <Card key={page.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <h3 className="font-medium">{page.title}</h3>
                        <p className="text-sm text-muted-foreground">/{page.slug}</p>
                      </div>
                      <Badge variant={page.is_published ? 'default' : 'secondary'}>
                        {page.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePublish(page)}
                        title={page.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {page.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(page)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(page.id)}
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
    </AdminLayout>
  );
}
