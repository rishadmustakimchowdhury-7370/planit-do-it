import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Briefcase,
  Edit,
  Save,
  X,
  Plus,
  FileText,
  Download,
  Upload,
  MessageSquare,
  Calendar,
  DollarSign,
  Users,
  ArrowLeft,
  MoreHorizontal,
  Linkedin,
  ExternalLink,
  Loader2,
  Trash2,
  User,
  Clock,
  Send,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SendClientEmailModal } from '@/components/email/SendClientEmailModal';

interface Client {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company_size: string | null;
  billing_terms: string | null;
  preferred_communication: string | null;
  linkedin_url: string | null;
  headquarters: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tags: any[];
  total_revenue: number;
  last_contact_at: string | null;
}

interface Job {
  id: string;
  title: string;
  status: string;
  location: string | null;
  created_at: string;
}

interface Activity {
  id: string;
  activity_type: string;
  description: string | null;
  created_at: string;
  metadata: any;
  created_by: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Prospect', label: 'Prospect' },
  { value: 'Inactive', label: 'Inactive' },
];

const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1001-5000', label: '1001-5000 employees' },
  { value: '5000+', label: '5000+ employees' },
];

const BILLING_TERMS_OPTIONS = [
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Due on Receipt', label: 'Due on Receipt' },
];

const COMMUNICATION_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();
  
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  
  // Modals
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  // File upload
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (id && tenantId) {
      fetchClientData();
    }
  }, [id, tenantId]);

  const fetchClientData = async () => {
    setIsLoading(true);
    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;
      
      // Parse tags if it's a string
      const parsedClient: Client = {
        ...clientData,
        tags: Array.isArray(clientData.tags) ? clientData.tags : [],
      } as Client;
      setClient(parsedClient);
      setEditForm(parsedClient);

      // Fetch jobs for this client
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, status, location, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      setJobs(jobsData || []);

      // Fetch activities
      const { data: activitiesData } = await supabase
        .from('client_activities')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      setActivities(activitiesData || []);

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from('client_attachments')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      setAttachments(attachmentsData || []);

    } catch (error: any) {
      console.error('Error fetching client:', error);
      toast.error('Failed to load client');
      navigate('/clients');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!client || !editForm) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: editForm.name,
          industry: editForm.industry,
          website: editForm.website,
          contact_name: editForm.contact_name,
          contact_email: editForm.contact_email,
          contact_phone: editForm.contact_phone,
          address: editForm.address,
          notes: editForm.notes,
          is_active: editForm.is_active,
          company_size: editForm.company_size,
          billing_terms: editForm.billing_terms,
          preferred_communication: editForm.preferred_communication,
          linkedin_url: editForm.linkedin_url,
          headquarters: editForm.headquarters,
          address_line1: editForm.address_line1,
          address_line2: editForm.address_line2,
          city: editForm.city,
          state: editForm.state,
          postal_code: editForm.postal_code,
          country: editForm.country,
          tags: editForm.tags,
        })
        .eq('id', client.id);

      if (error) throw error;

      // Log activity
      await supabase.from('client_activities').insert({
        client_id: client.id,
        tenant_id: tenantId,
        activity_type: 'update',
        description: 'Client details updated',
        created_by: user?.id,
      });

      toast.success('Client details updated');
      setClient({ ...client, ...editForm });
      setIsEditing(false);
      fetchClientData();
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !client) return;
    
    setIsAddingNote(true);
    try {
      const { error } = await supabase.from('client_activities').insert({
        client_id: client.id,
        tenant_id: tenantId,
        activity_type: 'note',
        description: noteText,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Note added');
      setNoteText('');
      setShowNoteDialog(false);
      fetchClientData();
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !client) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${tenantId}/client-attachments/${client.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        // Determine file type
        let fileType = 'other';
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes('contract')) fileType = 'contract';
        else if (lowerName.includes('nda')) fileType = 'nda';
        else if (lowerName.includes('jd') || lowerName.includes('job')) fileType = 'jd';

        const { error: insertError } = await supabase.from('client_attachments').insert({
          client_id: client.id,
          tenant_id: tenantId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: fileType,
          file_size: file.size,
          uploaded_by: user?.id,
        });

        if (insertError) throw insertError;

        // Log activity
        await supabase.from('client_activities').insert({
          client_id: client.id,
          tenant_id: tenantId,
          activity_type: 'attachment',
          description: `File uploaded: ${file.name}`,
          created_by: user?.id,
        });
      }

      toast.success('File(s) uploaded');
      fetchClientData();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase
        .from('client_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;

      toast.success('Attachment deleted');
      fetchClientData();
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'note': return <MessageSquare className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'update': return <Edit className="w-4 h-4" />;
      case 'attachment': return <FileText className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout title="Client Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Client not found</p>
          <Button onClick={() => navigate('/clients')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>
        </div>
      </AppLayout>
    );
  }

  const openJobsCount = jobs.filter(j => j.status === 'open').length;
  const placementsCount = jobs.filter(j => j.status === 'filled').length;

  return (
    <AppLayout title={client.name} subtitle="Client Overview">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/clients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowEmailModal(true)}>
            <Mail className="w-4 h-4 mr-2" />
            Send Email
          </Button>
          {client.contact_phone && (
            <Button variant="outline" asChild>
              <a href={`tel:${client.contact_phone}`}>
                <Phone className="w-4 h-4 mr-2" />
                Call
              </a>
            </Button>
          )}
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setIsEditing(false); setEditForm(client); }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Client Header Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20 rounded-xl">
              <AvatarImage src={client.logo_url || ''} alt={client.name} />
              <AvatarFallback className="rounded-xl text-2xl bg-accent/10 text-accent">
                {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {isEditing ? (
                  <Input
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="text-2xl font-bold h-10 max-w-md"
                  />
                ) : (
                  <h1 className="text-2xl font-bold">{client.name}</h1>
                )}
                <Badge 
                  variant="outline" 
                  className={cn(
                    client.is_active 
                      ? 'bg-success/10 text-success border-success/30' 
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {client.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              {isEditing ? (
                <Input
                  value={editForm.industry || ''}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  placeholder="Industry"
                  className="max-w-xs mb-2"
                />
              ) : (
                client.industry && <p className="text-accent mb-2">{client.industry}</p>
              )}
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {client.contact_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {client.contact_name}
                  </span>
                )}
                {client.contact_email && (
                  <a href={`mailto:${client.contact_email}`} className="flex items-center gap-1 hover:text-accent">
                    <Mail className="w-4 h-4" />
                    {client.contact_email}
                  </a>
                )}
                {client.contact_phone && (
                  <a href={`tel:${client.contact_phone}`} className="flex items-center gap-1 hover:text-accent">
                    <Phone className="w-4 h-4" />
                    {client.contact_phone}
                  </a>
                )}
                {client.website && (
                  <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent">
                    <Globe className="w-4 h-4" />
                    Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {client.linkedin_url && (
                  <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Briefcase className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openJobsCount}</p>
                <p className="text-sm text-muted-foreground">Open Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Users className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{placementsCount}</p>
                <p className="text-sm text-muted-foreground">Placements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Calendar className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {client.last_contact_at 
                    ? formatDistanceToNow(new Date(client.last_contact_at), { addSuffix: true })
                    : 'Never'
                  }
                </p>
                <p className="text-sm text-muted-foreground">Last Contact</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <MessageSquare className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activities.filter(a => a.activity_type === 'note').length}</p>
                <p className="text-sm text-muted-foreground">Notes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="attachments">Files ({attachments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Primary Contact</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.contact_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                      />
                    ) : (
                      <p>{client.contact_name || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Email</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.contact_email || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                      />
                    ) : (
                      <p>{client.contact_email || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Phone</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.contact_phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                      />
                    ) : (
                      <p>{client.contact_phone || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Website</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.website || ''}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      />
                    ) : (
                      <p>{client.website || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">LinkedIn</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.linkedin_url || ''}
                        onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                      />
                    ) : (
                      <p>{client.linkedin_url || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Headquarters</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.headquarters || ''}
                        onChange={(e) => setEditForm({ ...editForm, headquarters: e.target.value })}
                      />
                    ) : (
                      <p>{client.headquarters || '-'}</p>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Address</Label>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Address Line 1"
                        value={editForm.address_line1 || ''}
                        onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
                      />
                      <Input
                        placeholder="Address Line 2"
                        value={editForm.address_line2 || ''}
                        onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="City"
                          value={editForm.city || ''}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        />
                        <Input
                          placeholder="State"
                          value={editForm.state || ''}
                          onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Postal Code"
                          value={editForm.postal_code || ''}
                          onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                        />
                        <Input
                          placeholder="Country"
                          value={editForm.country || ''}
                          onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">
                      {[
                        client.address_line1,
                        client.address_line2,
                        [client.city, client.state].filter(Boolean).join(', '),
                        client.postal_code,
                        client.country
                      ].filter(Boolean).join('\n') || client.address || '-'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Company Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Company Size</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.company_size || ''}
                        onValueChange={(value) => setEditForm({ ...editForm, company_size: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANY_SIZE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p>{client.company_size || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Billing Terms</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.billing_terms || ''}
                        onValueChange={(value) => setEditForm({ ...editForm, billing_terms: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_TERMS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p>{client.billing_terms || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Preferred Communication</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.preferred_communication || 'email'}
                        onValueChange={(value) => setEditForm({ ...editForm, preferred_communication: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMUNICATION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="capitalize">{client.preferred_communication || 'Email'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Status</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.is_active ? 'Active' : 'Inactive'}
                        onValueChange={(value) => setEditForm({ ...editForm, is_active: value === 'Active' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={client.is_active ? 'default' : 'secondary'}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Notes</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{client.notes || 'No notes yet.'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Associated Jobs</CardTitle>
              <Button onClick={() => navigate(`/jobs/new?client=${client.id}`)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Job
              </Button>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No jobs associated with this client yet.</p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate(`/jobs/new?client=${client.id}`)}>
                    Create First Job
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.id}`}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h4 className="font-medium">{job.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {job.location || 'Remote'} • Created {format(new Date(job.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge
                        variant={
                          job.status === 'open' ? 'default' :
                          job.status === 'filled' ? 'secondary' :
                          'outline'
                        }
                      >
                        {job.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
              <Button variant="outline" onClick={() => setShowNoteDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No activity recorded yet.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {activities.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex gap-4"
                      >
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            activity.activity_type === 'note' ? 'bg-info/10 text-info' :
                            activity.activity_type === 'email' ? 'bg-accent/10 text-accent' :
                            activity.activity_type === 'call' ? 'bg-success/10 text-success' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          {index < activities.length - 1 && (
                            <div className="w-px h-full bg-border min-h-[40px]" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {activity.activity_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm">{activity.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Files & Attachments</CardTitle>
              <div>
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button asChild disabled={isUploading}>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload File
                  </label>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No files uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-accent" />
                        <div>
                          <p className="font-medium text-sm">{attachment.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.file_type && (
                              <Badge variant="outline" className="mr-2 text-xs capitalize">
                                {attachment.file_type}
                              </Badge>
                            )}
                            {attachment.file_size && `${(attachment.file_size / 1024).toFixed(1)} KB`}
                            {' • '}
                            {format(new Date(attachment.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter your note..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={isAddingNote || !noteText.trim()}>
              {isAddingNote ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      {client.contact_email && (
        <SendClientEmailModal
          open={showEmailModal}
          onOpenChange={setShowEmailModal}
          client={{
            id: client.id,
            name: client.name,
            contact_name: client.contact_name || '',
            contact_email: client.contact_email,
          }}
        />
      )}
    </AppLayout>
  );
}
