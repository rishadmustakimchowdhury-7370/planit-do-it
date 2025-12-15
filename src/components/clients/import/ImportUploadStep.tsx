import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedCSVData } from '../ImportClientsWizard';

interface ImportUploadStepProps {
  onFileUpload: (data: ParsedCSVData) => void;
  csvData: ParsedCSVData | null;
  onDownloadTemplate: () => void;
}

export function ImportUploadStep({
  onFileUpload,
  csvData,
  onDownloadTemplate,
}: ImportUploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setError(null);

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setError('CSV file must have at least a header row and one data row');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }

      onFileUpload({
        headers,
        rows,
        fileName: file.name,
        totalRows: rows.length,
      });
    } catch (err: any) {
      setError('Failed to parse CSV file');
      console.error('CSV parse error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Download */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Download Template</p>
              <p className="text-sm text-muted-foreground">
                Use our template for best results
              </p>
            </div>
            <Button variant="outline" onClick={onDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      {!csvData ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            error && 'border-destructive'
          )}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium">
                  Drag and drop your CSV file here
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse (max 10MB)
                </p>
              </div>
              <Button variant="outline" asChild>
                <span>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Choose File
                </span>
              </Button>
            </div>
          </label>
          {error && (
            <p className="text-sm text-destructive mt-4 flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              {error}
            </p>
          )}
        </div>
      ) : (
        <Card className="bg-success/5 border-success/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{csvData.fileName}</p>
                  <Check className="w-4 h-4 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {csvData.totalRows} rows • {csvData.headers.length} columns
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onFileUpload(null as any);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Preview */}
            <div className="mt-4 border rounded-lg overflow-hidden">
              <div className="bg-secondary/50 px-4 py-2 border-b">
                <p className="text-sm font-medium">Preview (first 5 rows)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/30">
                      {csvData.headers.slice(0, 6).map((header, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-medium truncate max-w-[150px]"
                        >
                          {header}
                        </th>
                      ))}
                      {csvData.headers.length > 6 && (
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          +{csvData.headers.length - 6} more
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {csvData.headers.slice(0, 6).map((header, j) => (
                          <td
                            key={j}
                            className="px-3 py-2 truncate max-w-[150px]"
                            title={row[header]}
                          >
                            {row[header] || '-'}
                          </td>
                        ))}
                        {csvData.headers.length > 6 && (
                          <td className="px-3 py-2 text-muted-foreground">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper to parse CSV line respecting quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
