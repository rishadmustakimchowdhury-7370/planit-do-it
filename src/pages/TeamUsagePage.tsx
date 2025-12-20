import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTeamUsageTracking, TeamMemberUsage, FeatureUsage } from '@/hooks/useUsageTracking';
import { useAuth } from '@/lib/auth';
import { 
  Download, 
  RefreshCw, 
  Search, 
  Users, 
  FileUp, 
  Sparkles, 
  Briefcase,
  CheckCircle,
  AlertTriangle,
  XCircle,
  BarChart3
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function UsageCell({ usage }: { usage: FeatureUsage }) {
  if (usage.limit === -1) {
    return (
      <div className="text-sm">
        <span className="font-medium">{usage.used}</span>
        <span className="text-muted-foreground"> / ∞</span>
      </div>
    );
  }

  const getColor = () => {
    if (usage.status === 'limit_reached') return 'text-destructive';
    if (usage.status === 'warning') return 'text-warning';
    return 'text-foreground';
  };

  return (
    <div className="space-y-1">
      <div className={`text-sm font-medium ${getColor()}`}>
        {usage.used} / {usage.limit}
      </div>
      <Progress value={usage.percent} className="h-1.5 w-20" />
    </div>
  );
}

function StatusBadge({ status }: { status: 'normal' | 'warning' | 'limit_reached' }) {
  switch (status) {
    case 'limit_reached':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Limit Reached
        </Badge>
      );
    case 'warning':
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 gap-1">
          <AlertTriangle className="h-3 w-3" />
          Near Limit
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1">
          <CheckCircle className="h-3 w-3" />
          Normal
        </Badge>
      );
  }
}

interface MemberDetailDialogProps {
  member: TeamMemberUsage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MemberDetailDialog({ member, open, onOpenChange }: MemberDetailDialogProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMemberActivities = async () => {
    if (!member) return;
    
    setIsLoading(true);
    try {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('recruiter_activities')
        .select('action_type, created_at, metadata')
        .eq('user_id', member.userId)
        .gte('created_at', periodStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.avatarUrl || undefined} />
              <AvatarFallback>{member.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <div>{member.fullName}</div>
              <div className="text-sm text-muted-foreground font-normal">{member.email}</div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Usage details for this team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Usage Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">CV Uploads</span>
                </div>
                <div className="text-2xl font-bold">
                  {member.cvUploads.used}
                  {member.cvUploads.limit !== -1 && (
                    <span className="text-sm text-muted-foreground font-normal">
                      {' '}/ {member.cvUploads.limit}
                    </span>
                  )}
                </div>
                <Progress value={member.cvUploads.percent} className="h-1.5 mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">AI Tests</span>
                </div>
                <div className="text-2xl font-bold">
                  {member.aiTests.used}
                  {member.aiTests.limit !== -1 && (
                    <span className="text-sm text-muted-foreground font-normal">
                      {' '}/ {member.aiTests.limit}
                    </span>
                  )}
                </div>
                <Progress value={member.aiTests.percent} className="h-1.5 mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-info" />
                  <span className="text-sm font-medium">Active Jobs</span>
                </div>
                <div className="text-2xl font-bold">
                  {member.jobs.used}
                  {member.jobs.limit !== -1 && (
                    <span className="text-sm text-muted-foreground font-normal">
                      {' '}/ {member.jobs.limit}
                    </span>
                  )}
                </div>
                <Progress value={member.jobs.percent} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Activity History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Recent Activity</h4>
              <Button variant="outline" size="sm" onClick={fetchMemberActivities}>
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Load History'}
              </Button>
            </div>

            {activities.length > 0 ? (
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Click "Load History" to view recent activities
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamUsagePage() {
  const { isOwner, isManager, isLoading: authLoading } = useAuth();
  const { teamUsage, isLoading, refreshTeamUsage } = useTeamUsageTracking();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMemberUsage | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Only owners and managers can access this page
  if (!authLoading && !isOwner && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredMembers = teamUsage.filter(member =>
    member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    const csvContent = [
      ['Recruiter Name', 'Email', 'Plan', 'CV Uploads (Used/Total)', 'AI Tests (Used/Total)', 'Jobs (Used/Total)', 'Status'],
      ...filteredMembers.map(m => [
        m.fullName,
        m.email,
        m.planName,
        `${m.cvUploads.used}/${m.cvUploads.limit === -1 ? 'Unlimited' : m.cvUploads.limit}`,
        `${m.aiTests.used}/${m.aiTests.limit === -1 ? 'Unlimited' : m.aiTests.limit}`,
        `${m.jobs.used}/${m.jobs.limit === -1 ? 'Unlimited' : m.jobs.limit}`,
        m.status.replace('_', ' ').toUpperCase(),
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-usage-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Usage report exported successfully');
  };

  const handleViewDetail = (member: TeamMemberUsage) => {
    setSelectedMember(member);
    setShowDetail(true);
  };

  // Summary stats
  const totalCVs = teamUsage.reduce((sum, m) => sum + m.cvUploads.used, 0);
  const totalAI = teamUsage.reduce((sum, m) => sum + m.aiTests.used, 0);
  const totalJobs = teamUsage.reduce((sum, m) => sum + m.jobs.used, 0);
  const atRisk = teamUsage.filter(m => m.status === 'limit_reached' || m.status === 'warning').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Usage Report</h1>
            <p className="text-muted-foreground">
              Monitor feature usage across your team
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refreshTeamUsage}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="text-2xl font-bold">{teamUsage.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <FileUp className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total CVs Uploaded</p>
                  <p className="text-2xl font-bold">{totalCVs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Sparkles className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total AI Tests</p>
                  <p className="text-2xl font-bold">{totalAI}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Near/At Limit</p>
                  <p className="text-2xl font-bold">{atRisk}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Usage Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Usage by Recruiter</CardTitle>
                <CardDescription>
                  Click on a recruiter to view detailed usage history
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No team members found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recruiter</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>CV Uploads</TableHead>
                    <TableHead>AI Tests</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow 
                      key={member.userId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetail(member)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatarUrl || undefined} />
                            <AvatarFallback>{member.fullName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{member.fullName}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.planName}</Badge>
                      </TableCell>
                      <TableCell>
                        <UsageCell usage={member.cvUploads} />
                      </TableCell>
                      <TableCell>
                        <UsageCell usage={member.aiTests} />
                      </TableCell>
                      <TableCell>
                        <UsageCell usage={member.jobs} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={member.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <MemberDetailDialog
          member={selectedMember}
          open={showDetail}
          onOpenChange={setShowDetail}
        />
      </div>
    </AppLayout>
  );
}
