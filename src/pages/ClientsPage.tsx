import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Building2, Mail, Phone, Globe, MoreHorizontal, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface ClientWithJobCount extends Client {
  jobCount: number;
}

const ClientsPage = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<ClientWithJobCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchClients();
    }
  }, [tenantId]);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data: clientsData, error } = await supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get job counts for each client
      const clientIds = clientsData?.map(c => c.id) || [];
      const { data: jobCounts } = await supabase
        .from('jobs')
        .select('client_id')
        .in('client_id', clientIds);

      const countMap: Record<string, number> = {};
      jobCounts?.forEach(j => {
        if (j.client_id) {
          countMap[j.client_id] = (countMap[j.client_id] || 0) + 1;
        }
      });

      const clientsWithCounts = (clientsData || []).map(client => ({
        ...client,
        jobCount: countMap[client.id] || 0,
      }));

      setClients(clientsWithCounts);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (clientId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: !isActive })
        .eq('id', clientId);

      if (error) throw error;
      toast.success(`Client ${!isActive ? 'activated' : 'deactivated'}`);
      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    }
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Clients" subtitle="Manage your client relationships and job assignments.">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72 pl-9 bg-card"
          />
        </div>
        <Button className="gap-2" onClick={() => navigate('/clients/new')}>
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Clients Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredClients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ y: -2 }}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="cursor-pointer"
            >
              <div className="bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-accent/30 transition-all">
                <div className="flex items-start gap-4">
                  <Avatar className="w-14 h-14 rounded-lg">
                    <AvatarImage src={client.logo_url || ''} alt={client.name} />
                    <AvatarFallback className="rounded-lg text-lg bg-accent/10 text-accent font-medium">
                      {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{client.name}</h3>
                        {client.industry && (
                          <p className="text-sm text-accent">{client.industry}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-xs',
                            client.is_active 
                              ? 'bg-success/10 text-success border-success/30' 
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {client.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleToggleActive(client.id, client.is_active)}>
                              {client.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
                      {client.contact_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {client.contact_name}
                        </span>
                      )}
                      {client.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {client.contact_email}
                        </span>
                      )}
                      {client.website && (
                        <a 
                          href={client.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-accent transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          Website
                        </a>
                      )}
                    </div>

                    <div className="mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {client.jobCount} active job{client.jobCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && filteredClients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No clients found matching your search.</p>
          <Button onClick={() => navigate('/clients/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Client
          </Button>
        </div>
      )}
    </AppLayout>
  );
};

export default ClientsPage;