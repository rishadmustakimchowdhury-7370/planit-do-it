import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedCSVData, ColumnMapping } from '../ImportClientsWizard';

interface ImportMappingStepProps {
  csvData: ParsedCSVData;
  columnMappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  importMode: 'create' | 'update' | 'upsert';
  onImportModeChange: (mode: 'create' | 'update' | 'upsert') => void;
  duplicatePolicy: 'skip' | 'overwrite' | 'merge';
  onDuplicatePolicyChange: (policy: 'skip' | 'overwrite' | 'merge') => void;
  matchKey: 'id' | 'email' | 'name';
  onMatchKeyChange: (key: 'id' | 'email' | 'name') => void;
}

const CRM_FIELDS = [
  { value: 'name', label: 'Company Name', required: true },
  { value: 'contact_name', label: 'Primary Contact Name', required: false },
  { value: 'contact_email', label: 'Contact Email', required: false },
  { value: 'contact_phone', label: 'Contact Phone', required: false },
  { value: 'website', label: 'Website', required: false },
  { value: 'linkedin_url', label: 'LinkedIn URL', required: false },
  { value: 'industry', label: 'Industry', required: false },
  { value: 'company_size', label: 'Company Size', required: false },
  { value: 'billing_terms', label: 'Billing Terms', required: false },
  { value: 'address_line1', label: 'Address Line 1', required: false },
  { value: 'address_line2', label: 'Address Line 2', required: false },
  { value: 'city', label: 'City', required: false },
  { value: 'state', label: 'State', required: false },
  { value: 'postal_code', label: 'Postal Code', required: false },
  { value: 'country', label: 'Country', required: false },
  { value: 'is_active', label: 'Status', required: false },
  { value: 'tags', label: 'Tags (comma-separated)', required: false },
  { value: 'notes', label: 'Notes', required: false },
  { value: 'headquarters', label: 'Headquarters', required: false },
];

export function ImportMappingStep({
  csvData,
  columnMappings,
  onMappingsChange,
  importMode,
  onImportModeChange,
  duplicatePolicy,
  onDuplicatePolicyChange,
  matchKey,
  onMatchKeyChange,
}: ImportMappingStepProps) {
  const updateMapping = (csvColumn: string, crmField: string | null) => {
    const updated = columnMappings.map(m =>
      m.csvColumn === csvColumn ? { ...m, crmField } : m
    );
    onMappingsChange(updated);
  };

  const getMappedCount = () => {
    return columnMappings.filter(m => m.crmField).length;
  };

  const hasRequiredMapped = () => {
    return columnMappings.some(m => m.crmField === 'name');
  };

  return (
    <div className="space-y-6">
      {/* Import Mode */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <Label className="text-sm font-medium">Import Mode</Label>
          <RadioGroup
            value={importMode}
            onValueChange={(v) => onImportModeChange(v as any)}
            className="grid grid-cols-3 gap-4"
          >
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-secondary/50 cursor-pointer">
              <RadioGroupItem value="create" id="create" />
              <div>
                <Label htmlFor="create" className="cursor-pointer font-medium">
                  Create New
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only create new clients
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-secondary/50 cursor-pointer">
              <RadioGroupItem value="update" id="update" />
              <div>
                <Label htmlFor="update" className="cursor-pointer font-medium">
                  Update Existing
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only update existing clients
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-secondary/50 cursor-pointer">
              <RadioGroupItem value="upsert" id="upsert" />
              <div>
                <Label htmlFor="upsert" className="cursor-pointer font-medium">
                  Create or Update
                </Label>
                <p className="text-xs text-muted-foreground">
                  Update if exists, create if not
                </p>
              </div>
            </div>
          </RadioGroup>

          {(importMode === 'update' || importMode === 'upsert') && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-sm">Match By</Label>
                <Select value={matchKey} onValueChange={(v) => onMatchKeyChange(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Contact Email</SelectItem>
                    <SelectItem value="name">Company Name</SelectItem>
                    <SelectItem value="id">Client ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Duplicate Handling</Label>
                <Select value={duplicatePolicy} onValueChange={(v) => onDuplicatePolicyChange(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                    <SelectItem value="overwrite">Overwrite existing</SelectItem>
                    <SelectItem value="merge">Merge (fill blanks only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Mapping */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label className="text-sm font-medium">Column Mapping</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Map your CSV columns to CRM fields
              </p>
            </div>
            <Badge variant={hasRequiredMapped() ? 'default' : 'destructive'}>
              {getMappedCount()} / {csvData.headers.length} mapped
            </Badge>
          </div>

          {!hasRequiredMapped() && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">Company Name is required</p>
            </div>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {columnMappings.map((mapping) => (
              <div
                key={mapping.csvColumn}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  mapping.crmField ? 'bg-success/5 border-success/20' : 'bg-secondary/30'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={mapping.csvColumn}>
                    {mapping.csvColumn}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Sample: {csvData.rows[0]?.[mapping.csvColumn] || '-'}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Select
                  value={mapping.crmField || 'none'}
                  onValueChange={(v) => updateMapping(mapping.csvColumn, v === 'none' ? null : v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Skip this column --</SelectItem>
                    {CRM_FIELDS.map((field) => (
                      <SelectItem
                        key={field.value}
                        value={field.value}
                        disabled={
                          columnMappings.some(
                            m => m.crmField === field.value && m.csvColumn !== mapping.csvColumn
                          )
                        }
                      >
                        {field.label}
                        {field.required && ' *'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mapping.crmField && (
                  <Check className="w-4 h-4 text-success flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
