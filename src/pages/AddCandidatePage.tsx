import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Save, Upload, Loader2, FileText, Link as LinkIcon, User, Files, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkUploadResult {
  fileName: string;
  status: 'pending' | 'parsing' | 'success' | 'error';
  candidateName?: string;
  error?: string;
}

export default function AddCandidatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'manual');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  
  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkUploadResult[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkCompleted, setBulkCompleted] = useState(false);

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
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['manual', 'cv', 'linkedin', 'bulk'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        toast.error('Please upload a PDF or DOCX file');
        return;
      }
      setCvFile(file);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => 
      ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)
    );
    
    if (validFiles.length !== files.length) {
      toast.warning(`${files.length - validFiles.length} files were skipped (only PDF/DOCX allowed)`);
    }
    
    setBulkFiles(validFiles);
    setBulkResults(validFiles.map(f => ({ fileName: f.name, status: 'pending' })));
  };

  const parseCV = async () => {
    if (!cvFile) {
      toast.error('Please select a CV file first');
      return;
    }

    setIsParsing(true);
    try {
      // Read file as base64 for proper PDF/DOCX handling
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          // Extract base64 data after the data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(cvFile);
      });

      const { data, error } = await supabase.functions.invoke('parse-cv', {
        body: { 
          cvBase64: base64,
          mimeType: cvFile.type 
        }
      });

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
        });
        toast.success('CV parsed successfully!');
        setActiveTab('manual');
      }
    } catch (error: any) {
      console.error('Error parsing CV:', error);
      toast.error(error.message || 'Failed to parse CV');
    } finally {
      setIsParsing(false);
    }
  };

  const parseLinkedIn = async () => {
    if (!linkedinUrl.trim()) {
      toast.error('Please enter a LinkedIn profile URL');
      return;
    }

    // Validate LinkedIn URL format
    const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i;
    if (!linkedinRegex.test(linkedinUrl.trim())) {
      toast.error('Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)');
      return;
    }

    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-cv', {
        body: { linkedinUrl: linkedinUrl.trim() }
      });

      if (error) throw error;

      if (data) {
        // Map response fields correctly - API returns full_name, not name
        setFormData({
          fullName: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          currentTitle: data.current_title || '',
          currentCompany: data.current_company || '',
          linkedinUrl: data.linkedin_url || linkedinUrl.trim(),
          summary: data.summary || '',
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : '',
          experienceYears: data.experience_years?.toString() || '',
        });
        
        // Show appropriate message based on what was extracted
        if (data.full_name) {
          toast.success(`LinkedIn profile imported! Name: ${data.full_name}. Please fill in any missing details manually.`);
        } else {
          toast.info('LinkedIn URL saved. Please fill in candidate details manually.');
        }
        setActiveTab('manual');
      }
    } catch (error: any) {
      console.error('Error parsing LinkedIn:', error);
      toast.error(error.message || 'Failed to parse LinkedIn profile');
    } finally {
      setIsParsing(false);
    }
  };

  const processBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    if (!tenantId) {
      toast.error('No tenant found. Please log in again.');
      return;
    }

    setIsBulkProcessing(true);
    setBulkProgress(0);

    const results = [...bulkResults];
    let successCount = 0;

    for (let i = 0; i < bulkFiles.length; i++) {
      const file = bulkFiles[i];
      results[i] = { ...results[i], status: 'parsing' };
      setBulkResults([...results]);

      try {
        // Read file as base64 for proper PDF/DOCX handling
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Parse CV with AI
        const { data, error } = await supabase.functions.invoke('parse-cv', {
          body: { 
            cvBase64: base64,
            mimeType: file.type 
          }
        });

        if (error) throw error;

        if (!data?.full_name || !data?.email) {
          throw new Error('Could not extract name and email from CV');
        }

        // Check if candidate already exists
        const { data: existing } = await supabase
          .from('candidates')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('email', data.email)
          .maybeSingle();

        // Upload CV file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${tenantId}/cvs/${Date.now()}_${data.full_name.replace(/\s+/g, '_')}.${fileExt}`;
        
        let cvFileUrl: string | null = null;
        try {
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file, { upsert: false });
          
          if (!uploadError) {
            cvFileUrl = fileName;
          }
        } catch (uploadErr) {
          console.error('CV upload error:', uploadErr);
        }

        if (existing) {
          // Update existing candidate instead of showing error
          const skillsArray = Array.isArray(data.skills) ? data.skills : [];
          
          const updateData: any = {
            full_name: data.full_name,
            phone: data.phone || null,
            location: data.location || null,
            current_title: data.current_title || null,
            current_company: data.current_company || null,
            linkedin_url: data.linkedin_url || null,
            summary: data.summary || null,
            skills: skillsArray.length > 0 ? skillsArray : null,
            experience_years: data.experience_years || null,
            updated_at: new Date().toISOString(),
          };
          
          if (cvFileUrl) {
            updateData.cv_file_url = cvFileUrl;
          }
          
          const { error: updateError } = await supabase
            .from('candidates')
            .update(updateData)
            .eq('id', existing.id);

          if (updateError) throw updateError;

          results[i] = { 
            ...results[i], 
            status: 'success', 
            candidateName: `${data.full_name} (updated)` 
          };
          successCount++;
        } else {
          // Insert candidate
          const skillsArray = Array.isArray(data.skills) ? data.skills : [];
          
          const { error: insertError } = await supabase.from('candidates').insert({
            tenant_id: tenantId,
            full_name: data.full_name,
            email: data.email,
            phone: data.phone || null,
            location: data.location || null,
            current_title: data.current_title || null,
            current_company: data.current_company || null,
            linkedin_url: data.linkedin_url || null,
            summary: data.summary || null,
            skills: skillsArray.length > 0 ? skillsArray : null,
            experience_years: data.experience_years || null,
            cv_file_url: cvFileUrl,
            status: 'new',
          });

          if (insertError) throw insertError;

          results[i] = { 
            ...results[i], 
            status: 'success', 
            candidateName: data.full_name 
          };
          successCount++;
        }
      } catch (error: any) {
        console.error(`Error processing ${file.name}:`, error);
        results[i] = { 
          ...results[i], 
          status: 'error', 
          error: error.message || 'Failed to process' 
        };
      }

      setBulkResults([...results]);
      setBulkProgress(((i + 1) / bulkFiles.length) * 100);
    }

    setIsBulkProcessing(false);
    setBulkCompleted(true);
    
    if (successCount > 0) {
      toast.success(`Successfully added ${successCount} candidate(s)`);
    }
    if (successCount < bulkFiles.length) {
      toast.warning(`${bulkFiles.length - successCount} file(s) had errors`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId) {
      toast.error('No tenant found. Please log in again.');
      return;
    }

    if (!formData.fullName.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setIsLoading(true);

    try {
      const skillsArray = formData.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      let cvFileUrl: string | null = null;

      // Upload CV file if exists
      if (cvFile) {
        const fileExt = cvFile.name.split('.').pop();
        const fileName = `${tenantId}/cvs/${Date.now()}_${formData.fullName.replace(/\s+/g, '_')}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, cvFile, { upsert: false });

        if (uploadError) {
          console.error('CV upload error:', uploadError);
          toast.warning('CV could not be uploaded, but candidate will still be created');
        } else {
          cvFileUrl = fileName;
        }
      }

      const { error } = await supabase.from('candidates').insert({
        tenant_id: tenantId,
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone || null,
        location: formData.location || null,
        current_title: formData.currentTitle || null,
        current_company: formData.currentCompany || null,
        linkedin_url: formData.linkedinUrl || null,
        summary: formData.summary || null,
        skills: skillsArray.length > 0 ? skillsArray : null,
        experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : null,
        cv_file_url: cvFileUrl,
        status: 'new',
      });

      if (error) throw error;

      toast.success('Candidate added successfully');
      navigate('/candidates');
    } catch (error: any) {
      console.error('Error adding candidate:', error);
      toast.error(error.message || 'Failed to add candidate');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/candidates')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add New Candidate</h1>
            <p className="text-muted-foreground">Add a candidate manually, via CV upload, LinkedIn, or bulk upload</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="manual" className="gap-2">
              <User className="h-4 w-4" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="cv" className="gap-2">
              <FileText className="h-4 w-4" />
              Upload CV
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              LinkedIn
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Files className="h-4 w-4" />
              Bulk
            </TabsTrigger>
          </TabsList>

          {/* Bulk Upload Tab */}
          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Resume Upload</CardTitle>
                <CardDescription>
                  Upload multiple CVs at once. We'll parse them with AI and create candidates automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    multiple
                    onChange={handleBulkFileChange}
                    className="hidden"
                  />
                  {bulkFiles.length > 0 ? (
                    <div className="space-y-2">
                      <Files className="h-12 w-12 mx-auto text-accent" />
                      <p className="font-medium">{bulkFiles.length} file(s) selected</p>
                      <Button variant="outline" size="sm" onClick={() => { setBulkFiles([]); setBulkResults([]); }}>
                        Clear All
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Drag & drop multiple CVs or click to upload</p>
                      <p className="text-xs text-muted-foreground">Supports PDF and DOCX files</p>
                      <Button variant="outline" onClick={() => bulkFileInputRef.current?.click()}>
                        Select Files
                      </Button>
                    </div>
                  )}
                </div>

                {bulkResults.length > 0 && (
                  <div className="space-y-3">
                    {isBulkProcessing && (
                      <div className="space-y-2">
                        <Progress value={bulkProgress} className="h-2" />
                        <p className="text-sm text-muted-foreground text-center">
                          Processing... {Math.round(bulkProgress)}%
                        </p>
                      </div>
                    )}
                    
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {bulkResults.map((result, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            result.status === 'success' && "bg-success/10 border-success/30",
                            result.status === 'error' && "bg-destructive/10 border-destructive/30",
                            result.status === 'parsing' && "bg-info/10 border-info/30",
                            result.status === 'pending' && "bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {result.status === 'success' && <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />}
                            {result.status === 'error' && <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                            {result.status === 'parsing' && <Loader2 className="h-4 w-4 animate-spin text-info flex-shrink-0" />}
                            {result.status === 'pending' && <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{result.fileName}</p>
                              {result.candidateName && (
                                <p className="text-xs text-muted-foreground">{result.candidateName}</p>
                              )}
                              {result.error && (
                                <p className="text-xs text-destructive">{result.error}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bulkCompleted ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-2">
                      <CheckCircle className="h-8 w-8 text-success" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Upload Complete!</h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        {bulkResults.filter(r => r.status === 'success').length} of {bulkResults.length} candidate(s) processed successfully
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setBulkFiles([]);
                          setBulkResults([]);
                          setBulkProgress(0);
                          setBulkCompleted(false);
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload More CVs
                      </Button>
                      <Button onClick={() => navigate('/candidates')}>
                        View All Candidates
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={processBulkUpload} 
                    disabled={bulkFiles.length === 0 || isBulkProcessing}
                    className="w-full"
                  >
                    {isBulkProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Process {bulkFiles.length} Resume(s)
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cv">
            <Card>
              <CardHeader>
                <CardTitle>Upload CV</CardTitle>
                <CardDescription>
                  Upload a PDF or DOCX file and we'll extract the candidate information using AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {cvFile ? (
                    <div className="space-y-2">
                      <FileText className="h-12 w-12 mx-auto text-accent" />
                      <p className="font-medium">{cvFile.name}</p>
                      <Button variant="outline" size="sm" onClick={() => setCvFile(null)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Drag & drop or click to upload</p>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        Select File
                      </Button>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={parseCV} 
                  disabled={!cvFile || isParsing}
                  className="w-full"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Parsing CV...
                    </>
                  ) : (
                    'Parse CV with AI'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="linkedin">
            <Card>
              <CardHeader>
                <CardTitle>Import from LinkedIn</CardTitle>
                <CardDescription>
                  Enter a LinkedIn profile URL to extract candidate information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="linkedinImport">LinkedIn Profile URL</Label>
                  <Input
                    id="linkedinImport"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>

                <Button 
                  onClick={parseLinkedIn} 
                  disabled={!linkedinUrl.trim() || isParsing}
                  className="w-full"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Parsing LinkedIn...
                    </>
                  ) : (
                    'Import from LinkedIn'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
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

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 234 567 890"
                    />
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="New York, NY"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Professional Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Professional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="currentTitle">Current Title</Label>
                      <Input
                        id="currentTitle"
                        value={formData.currentTitle}
                        onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                        placeholder="Software Engineer"
                      />
                    </div>

                    <div>
                      <Label htmlFor="currentCompany">Current Company</Label>
                      <Input
                        id="currentCompany"
                        value={formData.currentCompany}
                        onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                        placeholder="Tech Corp"
                      />
                    </div>

                    <div>
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

                    <div>
                      <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                      <Input
                        id="linkedinUrl"
                        value={formData.linkedinUrl}
                        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="skills">Skills (comma-separated)</Label>
                    <Input
                      id="skills"
                      value={formData.skills}
                      onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                      placeholder="React, TypeScript, Node.js, AWS"
                    />
                  </div>

                  <div>
                    <Label htmlFor="summary">Summary</Label>
                    <Textarea
                      id="summary"
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      placeholder="Brief professional summary..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => navigate('/candidates')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Add Candidate
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}