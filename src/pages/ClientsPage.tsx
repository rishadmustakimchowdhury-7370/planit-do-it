import { AppLayout } from '@/components/layout/AppLayout';
import { ClientCard } from '@/components/clients/ClientCard';
import { clients, jobs } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';

const ClientsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = clients.filter(client => 
    client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getJobCount = (clientId: string) => {
    return jobs.filter(job => job.clientId === clientId).length;
  };

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
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredClients.map((client, index) => (
          <ClientCard 
            key={client.id} 
            client={client} 
            jobCount={getJobCount(client.id)}
            index={index}
          />
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No clients found matching your search.
        </div>
      )}
    </AppLayout>
  );
};

export default ClientsPage;
