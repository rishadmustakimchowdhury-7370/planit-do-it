import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, ExternalLink, GripVertical, Loader2, Image as ImageIcon } from 'lucide-react';

interface TrustedClient {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminTrustedClientsPage() {
  const [clients, setClients] = useState<TrustedClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<TrustedClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    website_url: '',
    is_active: true,
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trusted_clients')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast.error('Failed to load trusted clients');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('trusted_clients')
          .update({
            name: formData.name,
            logo_url: formData.logo_url,
            website_url: formData.website_url || null,
            is_active: formData.is_active,
          })
          .eq('id', editingClient.id);

        if (error) throw error;
        toast.success('Client updated successfully');
      } else {
        const maxOrder = clients.length > 0 ? Math.max(...clients.map(c => c.display_order)) + 1 : 0;
        const { error } = await supabase
          .from('trusted_clients')
          .insert({
            name: formData.name,
            logo_url: formData.logo_url,
            website_url: formData.website_url || null,
            is_active: formData.is_active,
            display_order: maxOrder,
          });

        if (error) throw error;
        toast.success('Client added successfully');
      }

      setIsDialogOpen(false);
      setEditingClient(null);
      setFormData({ name: '', logo_url: '', website_url: '', is_active: true });
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save client');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (client: TrustedClient) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      logo_url: client.logo_url,
      website_url: client.website_url || '',
      is_active: client.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    try {
      const { error } = await supabase
        .from('trusted_clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Client deleted successfully');
      fetchClients();
    } catch (error: any) {
      toast.error('Failed to delete client');
    }
  };

  const toggleActive = async (client: TrustedClient) => {
    try {
      const { error } = await supabase
        .from('trusted_clients')
        .update({ is_active: !client.is_active })
        .eq('id', client.id);

      if (error) throw error;
      fetchClients();
    } catch (error: any) {
      toast.error('Failed to update client');
    }
  };

  const openAddDialog = () => {
    setEditingClient(null);
    setFormData({ name: '', logo_url: '', website_url: '', is_active: true });
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout title="Trusted Clients" description="Manage client logos displayed on the homepage">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trusted Clients</h1>
            <p className="text-muted-foreground">Manage client logos displayed on the homepage</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
                  <DialogDescription>
                    {editingClient ? 'Update client details' : 'Add a new client logo to display on the homepage'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Company Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Acme Corporation"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                      id="logo_url"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      required
                    />
                    {formData.logo_url && (
                      <div className="mt-2 p-4 border rounded-lg bg-muted/50 flex items-center justify-center">
                        <img 
                          src={formData.logo_url} 
                          alt="Preview" 
                          className="max-h-16 max-w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website_url">Website URL (optional)</Label>
                    <Input
                      id="website_url"
                      value={formData.website_url}
                      onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active (visible on homepage)</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingClient ? 'Update' : 'Add'} Client
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Client Logos</CardTitle>
            <CardDescription>
              These logos will be displayed in the "Trusted By" section on your homepage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No trusted clients added yet</p>
                <p className="text-sm">Add client logos to display on your homepage</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Logo</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell>
                        <div className="h-10 w-20 bg-muted rounded flex items-center justify-center overflow-hidden">
                          <img 
                            src={client.logo_url} 
                            alt={client.name}
                            className="max-h-8 max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {client.website_url ? (
                          <a 
                            href={client.website_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            Visit <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={client.is_active}
                          onCheckedChange={() => toggleActive(client)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
