import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, Palette, Globe, Link2, CheckCircle, ExternalLink, Eye } from 'lucide-react';

interface SiteBranding {
  id: string;
  site_title: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  meta_description: string | null;
  social_links: any;
  chat_widget_script: string | null;
}

export default function AdminBrandingPage() {
  const [branding, setBranding] = useState<SiteBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    site_title: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#0ea5e9',
    secondary_color: '#6366f1',
    meta_description: '',
    social_links: {
      facebook: '',
      twitter: '',
      linkedin: '',
      instagram: '',
    },
    chat_widget_script: '',
  });

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const { data, error } = await supabase
        .from('site_branding')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBranding(data);
        const socialLinks = typeof data.social_links === 'object' ? data.social_links : {};
        setFormData({
          site_title: data.site_title || '',
          logo_url: data.logo_url || '',
          favicon_url: data.favicon_url || '',
          primary_color: data.primary_color || '#0ea5e9',
          secondary_color: data.secondary_color || '#6366f1',
          meta_description: data.meta_description || '',
          social_links: {
            facebook: (socialLinks as any)?.facebook || '',
            twitter: (socialLinks as any)?.twitter || '',
            linkedin: (socialLinks as any)?.linkedin || '',
            instagram: (socialLinks as any)?.instagram || '',
          },
          chat_widget_script: data.chat_widget_script || '',
        });
      }
    } catch (error: any) {
      toast.error('Failed to fetch branding: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const brandingData = {
        site_title: formData.site_title || null,
        logo_url: formData.logo_url || null,
        favicon_url: formData.favicon_url || null,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        meta_description: formData.meta_description || null,
        social_links: formData.social_links,
        chat_widget_script: formData.chat_widget_script || null,
        updated_at: new Date().toISOString(),
      };

      if (branding) {
        const { error } = await supabase
          .from('site_branding')
          .update(brandingData)
          .eq('id', branding.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('site_branding')
          .insert(brandingData);
        if (error) throw error;
      }

      toast.success('Branding saved successfully! Changes will apply across the site.');
      fetchBranding();
    } catch (error: any) {
      toast.error('Failed to save branding: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;

      // Upload to public branding-assets bucket
      const { error: uploadError } = await supabase.storage
        .from('branding-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL from the public bucket
      const { data: urlData } = supabase.storage
        .from('branding-assets')
        .getPublicUrl(fileName);

      if (type === 'logo') {
        setFormData({ ...formData, logo_url: urlData.publicUrl });
      } else {
        setFormData({ ...formData, favicon_url: urlData.publicUrl });
      }

      toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully!`);
    } catch (error: any) {
      toast.error('Failed to upload file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Site Branding" description="Customize your site appearance">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Site Branding" description="Customize your site appearance - changes apply dynamically across the live site">
      <div className="space-y-6 max-w-4xl">
        {/* Current Live Branding Preview */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <CardTitle>Current Live Branding</CardTitle>
              </div>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Live
              </Badge>
            </div>
            <CardDescription>This is how your branding currently appears on the website</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Site Title</Label>
                <p className="font-medium">{branding?.site_title || 'HireMetrics'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Current Logo</Label>
                {branding?.logo_url ? (
                  <img src={branding.logo_url} alt="Current Logo" className="h-10 w-auto object-contain rounded border bg-white p-1" />
                ) : (
                  <span className="text-sm text-muted-foreground">No logo set</span>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Current Favicon</Label>
                {branding?.favicon_url ? (
                  <img src={branding.favicon_url} alt="Current Favicon" className="h-8 w-8 object-contain rounded border bg-white p-1" />
                ) : (
                  <span className="text-sm text-muted-foreground">Default favicon</span>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Brand Colors</Label>
                <div className="flex gap-2">
                  <div 
                    className="h-8 w-8 rounded border" 
                    style={{ backgroundColor: branding?.primary_color || '#0ea5e9' }}
                    title="Primary"
                  />
                  <div 
                    className="h-8 w-8 rounded border" 
                    style={{ backgroundColor: branding?.secondary_color || '#6366f1' }}
                    title="Secondary"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              General Information
            </CardTitle>
            <CardDescription>Basic site information and SEO settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Site Title</Label>
              <Input
                value={formData.site_title}
                onChange={(e) => setFormData({ ...formData, site_title: e.target.value })}
                placeholder="HireMetrics"
              />
              <p className="text-xs text-muted-foreground mt-1">This will appear in the browser tab</p>
            </div>
            <div>
              <Label>Meta Description</Label>
              <Textarea
                value={formData.meta_description}
                onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                placeholder="Your site description for SEO"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Logo & Favicon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Logo & Favicon
            </CardTitle>
            <CardDescription>Upload your brand assets - changes apply immediately after saving</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Logo</Label>
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 border rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo preview" className="h-full w-full object-contain p-2" />
                    ) : (
                      <span className="text-xs text-muted-foreground text-center">No logo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      disabled={uploading}
                    />
                    <Input
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="Or enter URL directly"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label>Favicon</Label>
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 border rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                    {formData.favicon_url ? (
                      <img src={formData.favicon_url} alt="Favicon preview" className="h-12 w-12 object-contain" />
                    ) : (
                      <span className="text-xs text-muted-foreground text-center">Default</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'favicon')}
                      disabled={uploading}
                    />
                    <Input
                      value={formData.favicon_url}
                      onChange={(e) => setFormData({ ...formData, favicon_url: e.target.value })}
                      placeholder="Or enter URL directly"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Recommended: 32x32 or 64x64 pixels, PNG or ICO format</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand Colors
            </CardTitle>
            <CardDescription>Define your brand color scheme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    placeholder="#0ea5e9"
                  />
                </div>
              </div>
              <div>
                <Label>Secondary Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Social Links
            </CardTitle>
            <CardDescription>Connect your social media profiles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Facebook</Label>
                <Input
                  value={formData.social_links.facebook}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_links: { ...formData.social_links, facebook: e.target.value }
                  })}
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              <div>
                <Label>Twitter</Label>
                <Input
                  value={formData.social_links.twitter}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_links: { ...formData.social_links, twitter: e.target.value }
                  })}
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>
              <div>
                <Label>LinkedIn</Label>
                <Input
                  value={formData.social_links.linkedin}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_links: { ...formData.social_links, linkedin: e.target.value }
                  })}
                  placeholder="https://linkedin.com/company/yourcompany"
                />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input
                  value={formData.social_links.instagram}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_links: { ...formData.social_links, instagram: e.target.value }
                  })}
                  placeholder="https://instagram.com/yourhandle"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Widget */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Widget Script</CardTitle>
            <CardDescription>Paste third-party chat widget script (e.g., Intercom, Crisp)</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.chat_widget_script}
              onChange={(e) => setFormData({ ...formData, chat_widget_script: e.target.value })}
              placeholder="<script>// Your chat widget script</script>"
              rows={6}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
