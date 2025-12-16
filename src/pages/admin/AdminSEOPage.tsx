import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { 
  Globe, 
  Search, 
  Upload, 
  CheckCircle, 
  FileText, 
  Code, 
  Loader2,
  ExternalLink,
  Copy,
  Info
} from 'lucide-react';

interface SEOSettings {
  google_verification_meta: string;
  google_verification_file: string;
  bing_verification_meta: string;
  bing_verification_file: string;
  sitemap_url: string;
  robots_txt: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_card: string;
  twitter_site: string;
  json_ld_schema: string;
}

const DEFAULT_SEO: SEOSettings = {
  google_verification_meta: '',
  google_verification_file: '',
  bing_verification_meta: '',
  bing_verification_file: '',
  sitemap_url: '',
  robots_txt: `User-agent: *
Allow: /

Sitemap: https://recruitifycrm.com/sitemap.xml`,
  canonical_url: '',
  og_title: '',
  og_description: '',
  og_image: '',
  twitter_card: 'summary_large_image',
  twitter_site: '',
  json_ld_schema: ''
};

export default function AdminSEOPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SEOSettings>(DEFAULT_SEO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingGoogle, setUploadingGoogle] = useState(false);
  const [uploadingBing, setUploadingBing] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'seo_settings')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setSettings({ ...DEFAULT_SEO, ...(data.value as any) });
      }
    } catch (error: any) {
      console.error('Failed to fetch SEO settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'seo_settings',
          value: settings as any,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;

      await supabase.from('audit_log').insert([{
        user_id: user.id,
        action: 'seo_settings_updated',
        entity_type: 'platform_settings',
        new_values: { settings } as any
      }]);

      toast.success('SEO settings saved successfully');
    } catch (error: any) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGoogleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.startsWith('google') || !file.name.endsWith('.html')) {
      toast.error('Please upload a valid Google verification file (google*.html)');
      return;
    }

    setUploadingGoogle(true);
    try {
      const content = await file.text();
      setSettings(prev => ({
        ...prev,
        google_verification_file: content,
        google_verification_meta: extractMetaContent(content) || prev.google_verification_meta
      }));
      toast.success('Google verification file uploaded');
    } catch (error: any) {
      toast.error('Failed to read file: ' + error.message);
    } finally {
      setUploadingGoogle(false);
    }
  };

  const handleBingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.includes('BingSiteAuth') && !file.name.endsWith('.xml')) {
      toast.error('Please upload a valid Bing verification file');
      return;
    }

    setUploadingBing(true);
    try {
      const content = await file.text();
      setSettings(prev => ({
        ...prev,
        bing_verification_file: content
      }));
      toast.success('Bing verification file uploaded');
    } catch (error: any) {
      toast.error('Failed to read file: ' + error.message);
    } finally {
      setUploadingBing(false);
    }
  };

  const extractMetaContent = (html: string): string | null => {
    const match = html.match(/content="([^"]+)"/);
    return match ? match[1] : null;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <AdminLayout title="SEO Settings" description="Configure search engine optimization">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="SEO Settings" description="Configure search engine optimization and site verification">
      <Tabs defaultValue="verification" className="space-y-6">
        <TabsList>
          <TabsTrigger value="verification">Site Verification</TabsTrigger>
          <TabsTrigger value="meta">Meta Tags</TabsTrigger>
          <TabsTrigger value="sitemap">Sitemap & Robots</TabsTrigger>
          <TabsTrigger value="schema">Schema Markup</TabsTrigger>
        </TabsList>

        {/* Site Verification */}
        <TabsContent value="verification" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Google Search Console */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Search className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Google Search Console</CardTitle>
                    <CardDescription>Verify your site with Google</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Meta Tag Verification</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="google-site-verification content value"
                      value={settings.google_verification_meta}
                      onChange={(e) => setSettings(prev => ({ ...prev, google_verification_meta: e.target.value }))}
                    />
                    {settings.google_verification_meta && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`<meta name="google-site-verification" content="${settings.google_verification_meta}" />`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter only the content value, not the full meta tag
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>HTML File Verification</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".html"
                      onChange={handleGoogleFileUpload}
                      disabled={uploadingGoogle}
                    />
                    {uploadingGoogle && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {settings.google_verification_file && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      File uploaded
                    </Badge>
                  )}
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">How to verify:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Go to <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Search Console</a></li>
                        <li>Add your property (URL prefix)</li>
                        <li>Choose HTML tag or file verification</li>
                        <li>Copy the meta tag content or download the HTML file</li>
                        <li>Paste/upload here and save</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bing Webmaster Tools */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Bing Webmaster Tools</CardTitle>
                    <CardDescription>Verify your site with Bing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Meta Tag Verification</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="msvalidate.01 content value"
                      value={settings.bing_verification_meta}
                      onChange={(e) => setSettings(prev => ({ ...prev, bing_verification_meta: e.target.value }))}
                    />
                    {settings.bing_verification_meta && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`<meta name="msvalidate.01" content="${settings.bing_verification_meta}" />`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter only the content value, not the full meta tag
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>XML File Verification</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".xml"
                      onChange={handleBingFileUpload}
                      disabled={uploadingBing}
                    />
                    {uploadingBing && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {settings.bing_verification_file && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      File uploaded
                    </Badge>
                  )}
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">How to verify:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Go to <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className="text-primary underline">Bing Webmaster Tools</a></li>
                        <li>Add your site URL</li>
                        <li>Choose meta tag or XML file verification</li>
                        <li>Copy the meta tag content or download the XML file</li>
                        <li>Paste/upload here and save</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Verification Status */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>Current verification configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`h-3 w-3 rounded-full ${settings.google_verification_meta || settings.google_verification_file ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <div>
                    <p className="font-medium">Google Search Console</p>
                    <p className="text-sm text-muted-foreground">
                      {settings.google_verification_meta ? 'Meta tag configured' : settings.google_verification_file ? 'File uploaded' : 'Not configured'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`h-3 w-3 rounded-full ${settings.bing_verification_meta || settings.bing_verification_file ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <div>
                    <p className="font-medium">Bing Webmaster Tools</p>
                    <p className="text-sm text-muted-foreground">
                      {settings.bing_verification_meta ? 'Meta tag configured' : settings.bing_verification_file ? 'File uploaded' : 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meta Tags */}
        <TabsContent value="meta" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Open Graph & Social Meta Tags</CardTitle>
              <CardDescription>Configure how your site appears when shared on social media</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>OG Title</Label>
                  <Input
                    placeholder="Recruitify CRM - Modern Recruitment Platform"
                    value={settings.og_title}
                    onChange={(e) => setSettings(prev => ({ ...prev, og_title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Canonical URL</Label>
                  <Input
                    placeholder="https://recruitifycrm.com"
                    value={settings.canonical_url}
                    onChange={(e) => setSettings(prev => ({ ...prev, canonical_url: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>OG Description</Label>
                <Textarea
                  placeholder="The modern recruitment CRM for agencies and HR teams..."
                  value={settings.og_description}
                  onChange={(e) => setSettings(prev => ({ ...prev, og_description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>OG Image URL</Label>
                <Input
                  placeholder="https://recruitifycrm.com/og-image.png"
                  value={settings.og_image}
                  onChange={(e) => setSettings(prev => ({ ...prev, og_image: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Recommended size: 1200x630 pixels</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Twitter Card Type</Label>
                  <Input
                    placeholder="summary_large_image"
                    value={settings.twitter_card}
                    onChange={(e) => setSettings(prev => ({ ...prev, twitter_card: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Twitter Site Handle</Label>
                  <Input
                    placeholder="@recruitifycrm"
                    value={settings.twitter_site}
                    onChange={(e) => setSettings(prev => ({ ...prev, twitter_site: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Meta Tags</CardTitle>
              <CardDescription>Copy these to your HTML head section</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
{`<!-- Search Engine Verification -->
${settings.google_verification_meta ? `<meta name="google-site-verification" content="${settings.google_verification_meta}" />` : '<!-- Google verification not configured -->'}
${settings.bing_verification_meta ? `<meta name="msvalidate.01" content="${settings.bing_verification_meta}" />` : '<!-- Bing verification not configured -->'}

<!-- Open Graph -->
${settings.og_title ? `<meta property="og:title" content="${settings.og_title}" />` : ''}
${settings.og_description ? `<meta property="og:description" content="${settings.og_description}" />` : ''}
${settings.og_image ? `<meta property="og:image" content="${settings.og_image}" />` : ''}
${settings.canonical_url ? `<meta property="og:url" content="${settings.canonical_url}" />` : ''}

<!-- Twitter -->
${settings.twitter_card ? `<meta name="twitter:card" content="${settings.twitter_card}" />` : ''}
${settings.twitter_site ? `<meta name="twitter:site" content="${settings.twitter_site}" />` : ''}
${settings.canonical_url ? `<link rel="canonical" href="${settings.canonical_url}" />` : ''}`}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    const metaTags = `<!-- Search Engine Verification -->
${settings.google_verification_meta ? `<meta name="google-site-verification" content="${settings.google_verification_meta}" />` : ''}
${settings.bing_verification_meta ? `<meta name="msvalidate.01" content="${settings.bing_verification_meta}" />` : ''}
<!-- Open Graph -->
${settings.og_title ? `<meta property="og:title" content="${settings.og_title}" />` : ''}
${settings.og_description ? `<meta property="og:description" content="${settings.og_description}" />` : ''}
${settings.og_image ? `<meta property="og:image" content="${settings.og_image}" />` : ''}
${settings.canonical_url ? `<meta property="og:url" content="${settings.canonical_url}" />` : ''}
<!-- Twitter -->
${settings.twitter_card ? `<meta name="twitter:card" content="${settings.twitter_card}" />` : ''}
${settings.twitter_site ? `<meta name="twitter:site" content="${settings.twitter_site}" />` : ''}
${settings.canonical_url ? `<link rel="canonical" href="${settings.canonical_url}" />` : ''}`;
                    copyToClipboard(metaTags);
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sitemap & Robots */}
        <TabsContent value="sitemap" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sitemap</CardTitle>
                <CardDescription>Configure your XML sitemap location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sitemap URL</Label>
                  <Input
                    placeholder="https://recruitifycrm.com/sitemap.xml"
                    value={settings.sitemap_url}
                    onChange={(e) => setSettings(prev => ({ ...prev, sitemap_url: e.target.value }))}
                  />
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Submit your sitemap to Google Search Console and Bing Webmaster Tools for better indexing.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Robots.txt</CardTitle>
                <CardDescription>Control search engine crawler access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  className="font-mono text-sm"
                  rows={8}
                  value={settings.robots_txt}
                  onChange={(e) => setSettings(prev => ({ ...prev, robots_txt: e.target.value }))}
                  placeholder={`User-agent: *
Allow: /

Sitemap: https://recruitifycrm.com/sitemap.xml`}
                />
                <p className="text-xs text-muted-foreground">
                  This will be served at /robots.txt
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schema Markup */}
        <TabsContent value="schema" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>JSON-LD Schema Markup</CardTitle>
              <CardDescription>Add structured data for rich search results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="font-mono text-sm"
                rows={15}
                value={settings.json_ld_schema}
                onChange={(e) => setSettings(prev => ({ ...prev, json_ld_schema: e.target.value }))}
                placeholder={`{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Recruitify CRM",
  "applicationCategory": "BusinessApplication",
  "description": "Modern recruitment CRM for agencies",
  "offers": {
    "@type": "Offer",
    "price": "9",
    "priceCurrency": "USD"
  }
}`}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Test with Google
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Schema Validator
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end mt-6">
        <Button onClick={saveSettings} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save SEO Settings
        </Button>
      </div>
    </AdminLayout>
  );
}