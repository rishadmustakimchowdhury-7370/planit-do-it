import { Briefcase, Users, Building2, Sparkles, Plus, FileText, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const allActions = [
  { label: 'Add Job', icon: Briefcase, href: '/jobs/new', color: 'bg-accent text-accent-foreground', roles: ['owner', 'manager'] },
  { label: 'Upload CV', icon: FileText, href: '/candidates/new', color: 'bg-success text-success-foreground', roles: ['owner', 'manager', 'recruiter'] },
  { label: 'Add Client', icon: Building2, href: '/clients/new', color: 'bg-warning text-warning-foreground', roles: ['owner', 'manager'] },
  { label: 'Run AI Match', icon: Sparkles, href: '/ai-match', color: 'bg-info text-info-foreground', roles: ['owner', 'manager'] },
];

export function QuickActions() {
  const { isOwner, isManager, isRecruiter, roles } = useAuth();
  const userRole = roles[0]?.role;

  // Filter actions based on user role
  const quickActions = allActions.filter(action => 
    action.roles.includes(userRole as 'owner' | 'manager' | 'recruiter')
  );

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <Link to={action.href}>
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex-col gap-2 hover:border-accent hover:bg-accent/5 transition-all"
              >
                <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
