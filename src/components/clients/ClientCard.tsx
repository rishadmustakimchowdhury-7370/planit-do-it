import { Client } from '@/types/recruitment';
import { Building2, Globe, User, Mail, Phone, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface ClientCardProps {
  client: Client;
  jobCount?: number;
  index?: number;
}

export function ClientCard({ client, jobCount = 0, index = 0 }: ClientCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ y: -2 }}
    >
      <Link
        to={`/clients/${client.id}`}
        className="block bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-accent/30 transition-all"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-foreground truncate">{client.companyName}</h3>
              <Badge variant="secondary" className="text-xs">
                {jobCount} jobs
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-4 h-4 text-accent" />
                <span className="truncate">{client.contactPerson}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-info" />
                <span className="truncate">{client.contactEmail}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-success" />
                <span>{client.contactPhone}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Globe className="w-4 h-4 text-warning" />
                <span className="truncate">{client.website}</span>
              </div>
            </div>
            
            {client.notes && (
              <div className="flex items-start gap-1.5 mt-3 text-sm text-muted-foreground">
                <FileText className="w-4 h-4 mt-0.5" />
                <span className="line-clamp-1">{client.notes}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
