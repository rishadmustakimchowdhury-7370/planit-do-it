import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Settings, Bell, Shield, Globe, Database } from 'lucide-react';

interface PlatformSettings {
  maintenance_mode: boolean;
  registration_enabled: boolean;
  trial_days: number;
  support_email: string;
  max_file_size_mb: number;
  allowed_file_types: string;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>({
    maintenance_mode: false,
    registration_enabled: true,
    trial_days: 14,
    support_email: 'info@recruitifycrm.com',
    max_file_size_mb: 10,
    allowed_file_types: 'pdf,doc,docx',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        const settingsMap: Record<string, any> = {};
        data.forEach((item) => {
          settingsMap[item.key] = item.value;
        });

        setSettings({
          maintenance_mode: settingsMap.maintenance_mode ?? false,
          registration_enabled: settingsMap.registration_enabled ?? true,
          trial_days: settingsMap.trial_days ?? 14,
          support_email: settingsMap.support_email ?? 'info@recruitifycrm.com',
          max_file_size_mb: settingsMap.max_file_size_mb ?? 10,
          allowed_file_types: settingsMap.allowed_file_types ?? 'pdf,doc,docx',
        });
      }
    } catch (error: any) {
      toast.error('Failed to fetch settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToSave = [
        { key: 'maintenance_mode', value: settings.maintenance_mode, description: 'Enable maintenance mode' },
        { key: 'registration_enabled', value: settings.registration_enabled, description: 'Allow new user registrations' },
        { key: 'trial_days', value: settings.trial_days, description: 'Number of days for free trial' },
        { key: 'support_email', value: settings.support_email, description: 'Support email address' },
        { key: 'max_file_size_mb', value: settings.max_file_size_mb, description: 'Maximum file upload size in MB' },
        { key: 'allowed_file_types', value: settings.allowed_file_types, description: 'Allowed file extensions' },
      ];

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('platform_settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            description: setting.description,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'key',
          });

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Platform Settings" description="Configure platform-wide settings">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Platform Settings" description="Configure platform-wide settings">
      <div className="space-y-6 max-w-4xl">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>Basic platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Disable access to the platform for all users except admins
                </p>
              </div>
              <Switch
                checked={settings.maintenance_mode}
                onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow New Registrations</Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable new user sign-ups
                </p>
              </div>
              <Switch
                checked={settings.registration_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, registration_enabled: checked })}
              />
            </div>
            <div>
              <Label>Support Email</Label>
              <Input
                value={settings.support_email}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                placeholder="support@example.com"
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Trial & Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Trial & Subscription
            </CardTitle>
            <CardDescription>Configure trial periods and subscription defaults</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Trial Period (Days)</Label>
              <Input
                type="number"
                value={settings.trial_days}
                onChange={(e) => setSettings({ ...settings, trial_days: parseInt(e.target.value) || 14 })}
                min={0}
                max={90}
                className="mt-2 w-32"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Number of days for free trial. Set to 0 to disable trials.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* File Upload Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              File Upload Settings
            </CardTitle>
            <CardDescription>Configure file upload restrictions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Maximum File Size (MB)</Label>
              <Input
                type="number"
                value={settings.max_file_size_mb}
                onChange={(e) => setSettings({ ...settings, max_file_size_mb: parseInt(e.target.value) || 10 })}
                min={1}
                max={100}
                className="mt-2 w-32"
              />
            </div>
            <div>
              <Label>Allowed File Types</Label>
              <Input
                value={settings.allowed_file_types}
                onChange={(e) => setSettings({ ...settings, allowed_file_types: e.target.value })}
                placeholder="pdf,doc,docx"
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Comma-separated list of allowed file extensions
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
