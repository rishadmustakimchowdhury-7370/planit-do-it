import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type CandidateStatus = Database['public']['Enums']['candidate_status'];

const candidateStatuses: { value: CandidateStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-muted text-muted-foreground' },
  { value: 'screening', label: 'Screening', color: 'bg-info/10 text-info border-info/30' },
  { value: 'interviewing', label: 'Interviewing', color: 'bg-accent/10 text-accent border-accent/30' },
  { value: 'offered', label: 'Offered', color: 'bg-warning/10 text-warning border-warning/30' },
  { value: 'hired', label: 'Hired', color: 'bg-success/20 text-success border-success/40' },
  { value: 'rejected', label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-muted text-muted-foreground' },
];

export default function EditCandidatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { tenantId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    currentTitle: '',
    currentCompany: '',
    linkedinUrl: '',
    summary: '',
    skills: '',
    experienceYears: '',
    status: 'new' as CandidateStatus,
  });

  useEffect(() => {
    if (id && tenantId) {
      fetchCandidate();
    }
  }, [id, tenantId]);

  const fetchCandidate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          fullName: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          currentTitle: data.current_title || '',
          currentCompany: data.current_company || '',
          linkedinUrl: data.linkedin_url || '',
          summary: data.summary || '',
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : '',
          experienceYears: data.experience_years?.toString() || '',
          status: data.status || 'new',
        });
      }
    } catch (error) {
      console.error('Error fetching candidate:', error);
      toast.error('Failed to load candidate');
      navigate('/candidates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId || !id) {
      toast.error('Missing required data');
      return;
    }

    if (!formData.fullName.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setIsSaving(true);

    try {
      const skillsArray = formData.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('candidates')
        .update({
          full_name: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          location: formData.location.trim() || null,
          current_title: formData.currentTitle.trim() || null,
          current_company: formData.currentCompany.trim() || null,
          linkedin_url: formData.linkedinUrl.trim() || null,
          summary: formData.summary.trim() || null,
          skills: skillsArray.length > 0 ? skillsArray : null,
          experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : null,
          status: formData.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Candidate updated successfully');
      navigate(`/candidates/${id}`);
    } catch (error: any) {
      console.error('Error updating candidate:', error);
      toast.error(error.message || 'Failed to update candidate');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Edit Candidate">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Edit Candidate" subtitle="Update candidate information">
      <div className="max-w-3xl mx-auto">
        <Link 
          to={`/candidates/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Candidate
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Edit Candidate Profile</CardTitle>
            <CardDescription>Update the candidate's information below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="New York, NY"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentTitle">Current Title</Label>
                  <Input
                    id="currentTitle"
                    value={formData.currentTitle}
                    onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                    placeholder="Software Engineer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentCompany">Current Company</Label>
                  <Input
                    id="currentCompany"
                    value={formData.currentCompany}
                    onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                    placeholder="Acme Inc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                  <Input
                    id="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/johndoe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experienceYears">Years of Experience</Label>
                  <Input
                    id="experienceYears"
                    type="number"
                    min="0"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                    placeholder="5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value: CandidateStatus) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(() => {
                          const statusInfo = candidateStatuses.find(s => s.value === formData.status);
                          return statusInfo ? (
                            <Badge variant="outline" className={cn('capitalize', statusInfo.color)}>
                              {statusInfo.label}
                            </Badge>
                          ) : formData.status;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {candidateStatuses.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <Badge variant="outline" className={cn('capitalize', s.color)}>
                            {s.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input
                  id="skills"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="React, TypeScript, Node.js"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary / Bio</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Brief professional summary..."
                  rows={4}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/candidates/${id}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
