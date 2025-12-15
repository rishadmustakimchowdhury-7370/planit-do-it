import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Download,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImportUploadStep } from './import/ImportUploadStep';
import { ImportMappingStep } from './import/ImportMappingStep';
import { ImportValidationStep } from './import/ImportValidationStep';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface ImportClientsWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export interface ParsedCSVData {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
  totalRows: number;
}

export interface ColumnMapping {
  csvColumn: string;
  crmField: string | null;
}

export interface ValidationResult {
  rowIndex: number;
  row: Record<string, string>;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
}

const STEPS = [
  { id: 1, title: 'Upload CSV', description: 'Upload your client data file' },
  { id: 2, title: 'Map Columns', description: 'Match CSV columns to CRM fields' },
  { id: 3, title: 'Validate & Import', description: 'Review and confirm import' },
];

export function ImportClientsWizard({
  open,
  onOpenChange,
  onImportComplete,
}: ImportClientsWizardProps) {
  const { tenantId, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [csvData, setCsvData] = useState<ParsedCSVData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [importMode, setImportMode] = useState<'create' | 'update' | 'upsert'>('upsert');
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'overwrite' | 'merge'>('skip');
  const [matchKey, setMatchKey] = useState<'id' | 'email' | 'name'>('email');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleClose = () => {
    setCsvData(null);
    setColumnMappings([]);
    setValidationResults([]);
    setCurrentStep(1);
    setImportProgress(0);
    onOpenChange(false);
  };

  const handleFileUpload = useCallback((data: ParsedCSVData) => {
    setCsvData(data);
    // Auto-generate initial mappings
    const initialMappings = data.headers.map(header => ({
      csvColumn: header,
      crmField: autoMapColumn(header),
    }));
    setColumnMappings(initialMappings);
  }, []);

  const handleNext = async () => {
    if (currentStep === 2) {
      // Validate before moving to step 3
      await validateData();
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateData = async () => {
    if (!csvData) return;

    setIsValidating(true);
    const results: ValidationResult[] = [];

    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get mapped values
      const mappedRow: Record<string, string> = {};
      columnMappings.forEach(mapping => {
        if (mapping.crmField) {
          mappedRow[mapping.crmField] = row[mapping.csvColumn] || '';
        }
      });

      // Validate required fields
      if (!mappedRow.name?.trim()) {
        errors.push('Company name is required');
      }

      // Validate email format
      if (mappedRow.contact_email && !isValidEmail(mappedRow.contact_email)) {
        errors.push('Invalid email format');
      }

      // Validate website URL
      if (mappedRow.website && !isValidUrl(mappedRow.website)) {
        warnings.push('Website URL may be invalid');
      }

      // Check for missing recommended fields
      if (!mappedRow.contact_email) {
        warnings.push('No contact email provided');
      }

      results.push({
        rowIndex: i,
        row: mappedRow,
        status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
        errors,
        warnings,
      });
    }

    setValidationResults(results);
    setIsValidating(false);
  };

  const handleImport = async () => {
    if (!csvData || !tenantId || !user) return;

    const validRows = validationResults.filter(r => r.status !== 'error');
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < validRows.length; i++) {
        const result = validRows[i];
        const row = result.row;

        try {
          // Check for duplicates if upsert mode
          if (importMode === 'upsert' || importMode === 'update') {
            let existingClient = null;

            if (matchKey === 'email' && row.contact_email) {
              const { data } = await supabase
                .from('clients')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('contact_email', row.contact_email)
                .maybeSingle();
              existingClient = data;
            } else if (matchKey === 'name' && row.name) {
              const { data } = await supabase
                .from('clients')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('name', row.name)
                .maybeSingle();
              existingClient = data;
            }

            if (existingClient) {
              if (duplicatePolicy === 'skip') {
                continue;
              } else if (duplicatePolicy === 'overwrite' || duplicatePolicy === 'merge') {
                const updateData: Record<string, any> = {};
                Object.entries(row).forEach(([key, value]) => {
                  if (value && (duplicatePolicy === 'overwrite' || !existingClient)) {
                    updateData[key] = value;
                  }
                });

                if (Object.keys(updateData).length > 0) {
                  await supabase
                    .from('clients')
                    .update(updateData)
                    .eq('id', existingClient.id);
                }
                successCount++;
                continue;
              }
            } else if (importMode === 'update') {
              continue; // Skip if no existing record in update mode
            }
          }

          // Insert new client
          const clientData: Record<string, any> = {
            tenant_id: tenantId,
            created_by: user.id,
          };

          Object.entries(row).forEach(([key, value]) => {
            if (value) {
              if (key === 'tags' && typeof value === 'string') {
                clientData.tags = value.split(',').map(t => t.trim());
              } else {
                clientData[key] = value;
              }
            }
          });

          const { error } = await supabase.from('clients').insert(clientData as any);

          if (error) throw error;
          successCount++;
        } catch (err: any) {
          errorCount++;
          errors.push(`Row ${result.rowIndex + 1}: ${err.message}`);
        }

        setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} clients`);
        onImportComplete?.();
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} rows failed to import`);
        console.error('Import errors:', errors);
      }

      handleClose();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'company_name',
      'primary_contact_first_name',
      'primary_contact_last_name',
      'primary_contact_email',
      'primary_contact_phone',
      'whatsapp',
      'website',
      'linkedin',
      'industry',
      'company_size',
      'billing_terms',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'postal_code',
      'country',
      'status',
      'tags',
      'notes',
    ];

    const sampleRow = [
      'Acme Corporation',
      'John',
      'Doe',
      'john.doe@acme.com',
      '+1-555-123-4567',
      '+1-555-123-4567',
      'https://acme.com',
      'https://linkedin.com/company/acme',
      'Technology',
      '51-200',
      'Net 30',
      '123 Business Ave',
      'Suite 100',
      'San Francisco',
      'CA',
      '94102',
      'United States',
      'Active',
      'enterprise,tech',
      'Premium client',
    ];

    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'client_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const canProceed = () => {
    if (currentStep === 1) return csvData !== null;
    if (currentStep === 2) return columnMappings.some(m => m.crmField === 'name');
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Clients
          </DialogTitle>
          <DialogDescription>
            Import clients from a CSV file in 3 easy steps.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2 py-4 border-b">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    currentStep > step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={cn(
                    'text-sm font-medium',
                    currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-5 h-5 mx-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === 1 && (
            <ImportUploadStep
              onFileUpload={handleFileUpload}
              csvData={csvData}
              onDownloadTemplate={downloadTemplate}
            />
          )}

          {currentStep === 2 && csvData && (
            <ImportMappingStep
              csvData={csvData}
              columnMappings={columnMappings}
              onMappingsChange={setColumnMappings}
              importMode={importMode}
              onImportModeChange={setImportMode}
              duplicatePolicy={duplicatePolicy}
              onDuplicatePolicyChange={setDuplicatePolicy}
              matchKey={matchKey}
              onMatchKeyChange={setMatchKey}
            />
          )}

          {currentStep === 3 && (
            <ImportValidationStep
              validationResults={validationResults}
              isValidating={isValidating}
              isImporting={isImporting}
              importProgress={importProgress}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? handleClose : handleBack}
            disabled={isImporting}
          >
            {currentStep === 1 ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {currentStep < 3 ? (
            <Button onClick={handleNext} disabled={!canProceed() || isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={isImporting || validationResults.filter(r => r.status !== 'error').length === 0}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing... {importProgress}%
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {validationResults.filter(r => r.status !== 'error').length} Clients
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions
function autoMapColumn(header: string): string | null {
  const normalized = header.toLowerCase().replace(/[_\s-]/g, '');
  const mappings: Record<string, string> = {
    companyname: 'name',
    company: 'name',
    name: 'name',
    clientname: 'name',
    primarycontactfirstname: 'contact_name',
    contactname: 'contact_name',
    contactfirstname: 'contact_name',
    firstname: 'contact_name',
    primarycontactemail: 'contact_email',
    contactemail: 'contact_email',
    email: 'contact_email',
    primarycontactphone: 'contact_phone',
    contactphone: 'contact_phone',
    phone: 'contact_phone',
    website: 'website',
    linkedin: 'linkedin_url',
    linkedinurl: 'linkedin_url',
    industry: 'industry',
    companysize: 'company_size',
    size: 'company_size',
    billingterms: 'billing_terms',
    addressline1: 'address_line1',
    address1: 'address_line1',
    address: 'address_line1',
    addressline2: 'address_line2',
    address2: 'address_line2',
    city: 'city',
    state: 'state',
    postalcode: 'postal_code',
    zipcode: 'postal_code',
    zip: 'postal_code',
    country: 'country',
    status: 'is_active',
    tags: 'tags',
    notes: 'notes',
  };
  return mappings[normalized] || null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return url.includes('.');
  }
}
