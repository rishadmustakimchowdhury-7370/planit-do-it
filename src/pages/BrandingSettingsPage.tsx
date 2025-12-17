import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Image,
  Save,
  Loader2,
  Upload,
  Palette,
  FileText,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface BrandingSettings {
  id?: string;
  company_name: string;
  logo_url: string;
  logo_position: 'top-left' | 'top-center' | 'top-right';
  footer_text: string;
  apply_to_cv: boolean;
  apply_to_jd: boolean;
  primary_color: string;
}

export default function BrandingSettingsPage() {
  const { tenantId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<BrandingSettings>({
    company_name: '',
    logo_url: '',
    logo_position: 'top-left',
    footer_text: '',
    apply_to_cv: false,
    apply_to_jd: false,
    primary_color: '#0052CC',
  });

  useEffect(() => {
    if (tenantId) {
      fetchBrandingSettings();
    }
  }, [tenantId]);

  const fetchBrandingSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          company_name: data.company_name || '',
          logo_url: data.logo_url || '',
          logo_position: (data.logo_position as 'top-left' | 'top-center' | 'top-right') || 'top-left',
          footer_text: data.footer_text || '',
          apply_to_cv: data.apply_to_cv || false,
          apply_to_jd: data.apply_to_jd || false,
          primary_color: data.primary_color || '#0052CC',
        });

        // Generate signed URL for logo preview
        if (data.logo_url) {
          const { data: signedData } = await supabase.storage
            .from('documents')
            .createSignedUrl(data.logo_url, 60 * 60);
          if (signedData?.signedUrl) {
            setLogoPreview(signedData.signedUrl);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching branding settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/branding-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      setSettings({ ...settings, logo_url: fileName });

      // Generate signed URL for preview
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(fileName, 60 * 60);
      
      if (signedData?.signedUrl) {
        setLogoPreview(signedData.signedUrl);
      }

      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;

    setIsSaving(true);
    try {
      const saveData = {
        tenant_id: tenantId,
        company_name: settings.company_name,
        logo_url: settings.logo_url,
        logo_position: settings.logo_position,
        footer_text: settings.footer_text,
        apply_to_cv: settings.apply_to_cv,
        apply_to_jd: settings.apply_to_jd,
        primary_color: settings.primary_color,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('branding_settings')
          .update(saveData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('branding_settings')
          .insert(saveData)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSettings({ ...settings, id: data.id });
        }
      }

      toast.success('Branding settings saved');
    } catch (error: any) {
      console.error('Error saving branding settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Document Branding" subtitle="Customize CV and Job Description branding">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Document Branding" subtitle="Customize CV and Job Description branding">
      <div className="max-w-3xl space-y-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              This information will appear on branded documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="Your Company Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer_text">Footer Text</Label>
              <Textarea
                id="footer_text"
                value={settings.footer_text}
                onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
                placeholder="e.g., Presented by Your Company | www.yourcompany.com"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                This text will appear at the bottom of branded documents
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logo Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logo Settings
            </CardTitle>
            <CardDescription>
              Upload your company logo for document branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-6">
              <div className="flex-1 space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors">
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span className="text-sm">Upload Logo</span>
                    </div>
                  </label>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                </div>
              </div>

              {logoPreview && (
                <div className="w-32 h-32 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Logo Position</Label>
              <Select
                value={settings.logo_position}
                onValueChange={(v) => setSettings({ ...settings, logo_position: v as any })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="top-center">Top Center</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Brand Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-28"
                  placeholder="#0052CC"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Apply Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Apply Branding
            </CardTitle>
            <CardDescription>
              Choose which documents should include your branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Apply to CV Downloads</p>
                <p className="text-sm text-muted-foreground">
                  Add your logo and footer to downloaded CVs
                </p>
              </div>
              <Switch
                checked={settings.apply_to_cv}
                onCheckedChange={(v) => setSettings({ ...settings, apply_to_cv: v })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Apply to Job Descriptions</p>
                <p className="text-sm text-muted-foreground">
                  Add your logo and contact info to JD exports
                </p>
              </div>
              <Switch
                checked={settings.apply_to_jd}
                onCheckedChange={(v) => setSettings({ ...settings, apply_to_jd: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        {(settings.apply_to_cv || settings.apply_to_jd) && logoPreview && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-white">
                <div className={`flex ${settings.logo_position === 'top-center' ? 'justify-center' : settings.logo_position === 'top-right' ? 'justify-end' : 'justify-start'}`}>
                  <img src={logoPreview} alt="Logo" className="h-12 object-contain" />
                </div>
                <div className="mt-8 space-y-2 text-muted-foreground">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
                {settings.footer_text && (
                  <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground">
                    {settings.footer_text}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
