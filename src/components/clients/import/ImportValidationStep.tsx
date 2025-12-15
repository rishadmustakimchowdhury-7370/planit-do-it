import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationResult } from '../ImportClientsWizard';

interface ImportValidationStepProps {
  validationResults: ValidationResult[];
  isValidating: boolean;
  isImporting: boolean;
  importProgress: number;
}

export function ImportValidationStep({
  validationResults,
  isValidating,
  isImporting,
  importProgress,
}: ImportValidationStepProps) {
  const validCount = validationResults.filter(r => r.status === 'valid').length;
  const warningCount = validationResults.filter(r => r.status === 'warning').length;
  const errorCount = validationResults.filter(r => r.status === 'error').length;
  const totalCount = validationResults.length;

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-lg font-medium">Validating your data...</p>
        <p className="text-sm text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-full max-w-md space-y-4">
          <Progress value={importProgress} className="h-2" />
          <div className="text-center">
            <p className="text-lg font-medium">Importing clients...</p>
            <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-success/5 border-success/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{validCount}</p>
                <p className="text-sm text-muted-foreground">Valid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{warningCount}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{errorCount}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Summary */}
      <Card>
        <CardContent className="pt-4">
          <p className="font-medium mb-2">Import Summary</p>
          <p className="text-sm text-muted-foreground">
            {validCount + warningCount} of {totalCount} rows will be imported.
            {errorCount > 0 && ` ${errorCount} rows will be skipped due to errors.`}
          </p>
        </CardContent>
      </Card>

      {/* Validation Results */}
      <Card>
        <CardContent className="pt-4">
          <p className="font-medium mb-4">Validation Details</p>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {validationResults.map((result) => (
                <div
                  key={result.rowIndex}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    result.status === 'valid' && 'bg-success/5 border-success/20',
                    result.status === 'warning' && 'bg-warning/5 border-warning/20',
                    result.status === 'error' && 'bg-destructive/5 border-destructive/20'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {result.status === 'valid' && (
                      <CheckCircle className="w-4 h-4 text-success" />
                    )}
                    {result.status === 'warning' && (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        Row {result.rowIndex + 1}
                        {result.row.name && `: ${result.row.name}`}
                      </p>
                      <Badge
                        variant={
                          result.status === 'valid'
                            ? 'default'
                            : result.status === 'warning'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-xs"
                      >
                        {result.status}
                      </Badge>
                    </div>
                    {result.errors.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {result.errors.map((error, i) => (
                          <li key={i} className="text-sm text-destructive">
                            • {error}
                          </li>
                        ))}
                      </ul>
                    )}
                    {result.warnings.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {result.warnings.map((warning, i) => (
                          <li key={i} className="text-sm text-warning">
                            • {warning}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
