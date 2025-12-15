import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface ExportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClientIds?: string[];
  filterApplied?: boolean;
}

const DEFAULT_COLUMNS = [
  { key: 'id', label: 'Client ID', default: true },
  { key: 'name', label: 'Company Name', default: true },
  { key: 'contact_name', label: 'Primary Contact Name', default: true },
  { key: 'contact_email', label: 'Primary Contact Email', default: true },
  { key: 'contact_phone', label: 'Primary Contact Phone', default: true },
  { key: 'website', label: 'Website', default: true },
  { key: 'linkedin_url', label: 'LinkedIn', default: false },
  { key: 'industry', label: 'Industry', default: true },
  { key: 'company_size', label: 'Company Size', default: false },
  { key: 'billing_terms', label: 'Billing Terms', default: false },
  { key: 'address_line1', label: 'Address Line 1', default: false },
  { key: 'address_line2', label: 'Address Line 2', default: false },
  { key: 'city', label: 'City', default: true },
  { key: 'state', label: 'State', default: false },
  { key: 'postal_code', label: 'Postal Code', default: false },
  { key: 'country', label: 'Country', default: true },
  { key: 'is_active', label: 'Status', default: true },
  { key: 'tags', label: 'Tags', default: false },
  { key: 'notes', label: 'Notes', default: false },
  { key: 'total_revenue', label: 'Total Revenue', default: false },
  { key: 'created_at', label: 'Created At', default: true },
  { key: 'updated_at', label: 'Updated At', default: false },
];

export function ExportClientsDialog({
  open,
  onOpenChange,
  selectedClientIds = [],
  filterApplied = false,
}: ExportClientsDialogProps) {
  const { tenantId } = useAuth();
  const [exportScope, setExportScope] = useState<'all' | 'selected' | 'filtered'>(
    selectedClientIds.length > 0 ? 'selected' : 'all'
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    DEFAULT_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(DEFAULT_COLUMNS.map(c => c.key));
  };

  const deselectAllColumns = () => {
    setSelectedColumns(['id', 'name']); // Keep minimum required
  };

  const handleExport = async () => {
    if (!tenantId) return;

    setIsExporting(true);
    try {
      let query = supabase.from('clients').select('*').eq('tenant_id', tenantId);

      if (exportScope === 'selected' && selectedClientIds.length > 0) {
        query = query.in('id', selectedClientIds);
      }

      const { data: clients, error } = await query.order('name');

      if (error) throw error;

      if (!clients || clients.length === 0) {
        toast.error('No clients to export');
        return;
      }

      // Build CSV content
      const headers = selectedColumns.map(key => {
        const col = DEFAULT_COLUMNS.find(c => c.key === key);
        return col?.label || key;
      });

      const rows = clients.map(client => {
        return selectedColumns.map(key => {
          let value = (client as any)[key];
          
          // Handle special cases
          if (key === 'tags' && Array.isArray(value)) {
            value = value.join(', ');
          } else if (key === 'is_active') {
            value = value ? 'Active' : 'Inactive';
          } else if (value === null || value === undefined) {
            value = '';
          } else if (typeof value === 'object') {
            value = JSON.stringify(value);
          }

          // Escape quotes and wrap in quotes if contains comma or newline
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
      });

      // Create CSV string
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      // Download file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${clients.length} clients`);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Failed to export clients');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Export Clients
          </DialogTitle>
          <DialogDescription>
            Select which clients and columns to include in your CSV export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Scope</Label>
            <RadioGroup value={exportScope} onValueChange={(v) => setExportScope(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal cursor-pointer">
                  All Clients
                </Label>
              </div>
              {selectedClientIds.length > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="font-normal cursor-pointer">
                    Selected Clients ({selectedClientIds.length})
                  </Label>
                </div>
              )}
              {filterApplied && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filtered" id="filtered" />
                  <Label htmlFor="filtered" className="font-normal cursor-pointer">
                    Filtered Results
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Column Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Columns to Export</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllColumns}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAllColumns}>
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg bg-secondary/30 max-h-60 overflow-y-auto">
              {DEFAULT_COLUMNS.map(col => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={col.key}
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                    disabled={col.key === 'id' || col.key === 'name'}
                  />
                  <Label
                    htmlFor={col.key}
                    className="text-sm font-normal cursor-pointer truncate"
                    title={col.label}
                  >
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Options</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="attachments"
                checked={includeAttachments}
                onCheckedChange={(checked) => setIncludeAttachments(!!checked)}
              />
              <Label htmlFor="attachments" className="text-sm font-normal cursor-pointer">
                Include attachment links (signed URLs)
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedColumns.length === 0}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
