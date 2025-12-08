import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, Loader2, Building2, Plus, Globe, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
}

export default function AddJobPage() {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
    salaryCurrency: 'USD',
    employmentType: 'full-time',
    experienceLevel: '',
    isRemote: false,
    openings: '1',
    clientId: '',
    skills: '',
  });

  const [newClient, setNewClient] = useState({
    name: '',
    website: '',
    industry: '',
    logoUrl: '',
  });

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      if (!tenantId) return;
      
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, logo_url, website, industry')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, [tenantId]);

  const handleCreateClient = async () => {
    if (!tenantId || !newClient.name.trim()) {
      toast.error('Client name is required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          tenant_id: tenantId,
          name: newClient.name,
          website: newClient.website || null,
          industry: newClient.industry || null,
          logo_url: newClient.logoUrl || null,
        })
        .select('id, name, logo_url, website, industry')
        .single();

      if (error) throw error;

      setClients([...clients, data]);
      setFormData({ ...formData, clientId: data.id });
      setShowNewClientForm(false);
      setNewClient({ name: '', website: '', industry: '', logoUrl: '' });
      toast.success('Client created successfully');
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error(error.message || 'Failed to create client');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId) {
      toast.error('No tenant found. Please log in again.');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Job title is required');
      return;
    }

    setIsLoading(true);

    try {
      const skillsArray = formData.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const { error } = await supabase.from('jobs').insert({
        tenant_id: tenantId,
        title: formData.title,
        description: formData.description || null,
        requirements: formData.requirements || null,
        location: formData.location || null,
        salary_min: formData.salaryMin ? parseFloat(formData.salaryMin) : null,
        salary_max: formData.salaryMax ? parseFloat(formData.salaryMax) : null,
        salary_currency: formData.salaryCurrency,
        employment_type: formData.employmentType,
        experience_level: formData.experienceLevel || null,
        is_remote: formData.isRemote,
        openings: parseInt(formData.openings) || 1,
        client_id: formData.clientId || null,
        skills: skillsArray.length > 0 ? skillsArray : null,
        status: 'draft',
      });

      if (error) throw error;

      toast.success('Job created successfully');
      navigate('/jobs');
    } catch (error: any) {
      console.error('Error creating job:', error);
      toast.error(error.message || 'Failed to create job');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedClient = clients.find(c => c.id === formData.clientId);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create New Job</h1>
            <p className="text-muted-foreground">Fill in the details to post a new job opening</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Client Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Client / Company
                </CardTitle>
                <CardDescription>Select or create the client this job is for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showNewClientForm ? (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label htmlFor="client">Select Client</Label>
                        <Select
                          value={formData.clientId}
                          onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={loadingClients ? "Loading clients..." : "Choose a client"} />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={client.logo_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {client.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{client.name}</span>
                                  {client.industry && (
                                    <span className="text-muted-foreground text-xs">({client.industry})</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowNewClientForm(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          New Client
                        </Button>
                      </div>
                    </div>

                    {/* Selected Client Preview */}
                    {selectedClient && (
                      <div className="p-4 rounded-lg bg-muted/50 border flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={selectedClient.logo_url || undefined} />
                          <AvatarFallback>
                            {selectedClient.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{selectedClient.name}</p>
                          {selectedClient.industry && (
                            <p className="text-sm text-muted-foreground">{selectedClient.industry}</p>
                          )}
                        </div>
                        {selectedClient.website && (
                          <a 
                            href={selectedClient.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-sm"
                          >
                            <Globe className="h-4 w-4" />
                            Website
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Create New Client</h4>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowNewClientForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="clientName">Company Name *</Label>
                        <Input
                          id="clientName"
                          value={newClient.name}
                          onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                          placeholder="e.g. Acme Corporation"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientIndustry">Industry</Label>
                        <Input
                          id="clientIndustry"
                          value={newClient.industry}
                          onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                          placeholder="e.g. Technology"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientWebsite">Website</Label>
                        <Input
                          id="clientWebsite"
                          value={newClient.website}
                          onChange={(e) => setNewClient({ ...newClient, website: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientLogo">Logo URL</Label>
                        <Input
                          id="clientLogo"
                          value={newClient.logoUrl}
                          onChange={(e) => setNewClient({ ...newClient, logoUrl: e.target.value })}
                          placeholder="https://example.com/logo.png"
                        />
                      </div>
                    </div>
                    
                    <Button type="button" onClick={handleCreateClient}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Client
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
                <CardDescription>Basic details about the position</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Senior Software Engineer"
                    className="text-lg"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Job Description</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use the editor to format your job description with headings, lists, and links
                  </p>
                  <RichTextEditor
                    content={formData.description}
                    onChange={(content) => setFormData({ ...formData, description: content })}
                    placeholder="Describe the role, responsibilities, and what you're looking for..."
                  />
                </div>

                <div>
                  <Label htmlFor="requirements">Requirements</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    List the key requirements and qualifications
                  </p>
                  <RichTextEditor
                    content={formData.requirements}
                    onChange={(content) => setFormData({ ...formData, requirements: content })}
                    placeholder="• 5+ years of experience...
• Bachelor's degree in Computer Science...
• Strong communication skills..."
                  />
                </div>

                <div>
                  <Label htmlFor="skills">Required Skills</Label>
                  <Input
                    id="skills"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    placeholder="e.g. React, TypeScript, Node.js, PostgreSQL (comma separated)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Separate skills with commas</p>
                </div>
              </CardContent>
            </Card>

            {/* Job Details */}
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
                <CardDescription>Location, type, and other specifics</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. New York, NY"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <Label htmlFor="isRemote" className="cursor-pointer">Remote Position</Label>
                    <p className="text-xs text-muted-foreground">Allow working from anywhere</p>
                  </div>
                  <Switch
                    id="isRemote"
                    checked={formData.isRemote}
                    onCheckedChange={(checked) => setFormData({ ...formData, isRemote: checked })}
                  />
                </div>

                <div>
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select
                    value={formData.employmentType}
                    onValueChange={(value) => setFormData({ ...formData, employmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="experienceLevel">Experience Level</Label>
                  <Select
                    value={formData.experienceLevel}
                    onValueChange={(value) => setFormData({ ...formData, experienceLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                      <SelectItem value="mid">Mid Level (2-5 years)</SelectItem>
                      <SelectItem value="senior">Senior Level (5-8 years)</SelectItem>
                      <SelectItem value="lead">Lead / Manager (8+ years)</SelectItem>
                      <SelectItem value="executive">Executive / Director</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="openings">Number of Openings</Label>
                  <Input
                    id="openings"
                    type="number"
                    min="1"
                    value={formData.openings}
                    onChange={(e) => setFormData({ ...formData, openings: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Salary */}
            <Card>
              <CardHeader>
                <CardTitle>Compensation</CardTitle>
                <CardDescription>Salary range for this position (optional)</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="salaryCurrency">Currency</Label>
                  <Select
                    value={formData.salaryCurrency}
                    onValueChange={(value) => setFormData({ ...formData, salaryCurrency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="BDT">BDT (৳)</SelectItem>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                      <SelectItem value="AUD">AUD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="salaryMin">Minimum Salary</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    min="0"
                    value={formData.salaryMin}
                    onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
                    placeholder="e.g. 80000"
                  />
                </div>

                <div>
                  <Label htmlFor="salaryMax">Maximum Salary</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    min="0"
                    value={formData.salaryMax}
                    onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
                    placeholder="e.g. 120000"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Job will be saved as draft. You can publish it later.
              </p>
              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => navigate('/jobs')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Job
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}