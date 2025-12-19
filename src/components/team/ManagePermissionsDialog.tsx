import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { Permission, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS } from '@/hooks/usePermissions';

interface ManagePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userRole: string;
  onUpdate: () => void;
}

const ALL_PERMISSIONS: Permission[] = [
  'can_add_jobs',
  'can_add_clients',
  'can_use_ai_match',
  'can_view_reports',
  'can_manage_team',
  'can_view_billing',
];

export function ManagePermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userRole,
  onUpdate,
}: ManagePermissionsDialogProps) {
  const { tenantId, user } = useAuth();
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!userId || !tenantId || !open) return;

      setIsFetching(true);
      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        setSelectedPermissions(data?.map(p => p.permission as Permission) || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        toast.error('Failed to load permissions');
      } finally {
        setIsFetching(false);
      }
    }

    fetchPermissions();
  }, [userId, tenantId, open]);

  const handleTogglePermission = (permission: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSave = async () => {
    if (!userId || !tenantId || !user?.id) return;

    setIsLoading(true);
    try {
      // Delete all existing permissions for this user
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;

      // Insert new permissions
      if (selectedPermissions.length > 0) {
        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(
            selectedPermissions.map(permission => ({
              user_id: userId,
              tenant_id: tenantId,
              permission,
              granted_by: user.id,
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success('Permissions updated successfully');
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      toast.error(error.message || 'Failed to update permissions');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Manage Permissions
          </DialogTitle>
          <DialogDescription>
            Set specific permissions for {userName} ({userRole})
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {ALL_PERMISSIONS.map(permission => (
                <div key={permission} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id={permission}
                    checked={selectedPermissions.includes(permission)}
                    onCheckedChange={() => handleTogglePermission(permission)}
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={permission}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {PERMISSION_LABELS[permission]}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {PERMISSION_DESCRIPTIONS[permission]}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Permissions'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
