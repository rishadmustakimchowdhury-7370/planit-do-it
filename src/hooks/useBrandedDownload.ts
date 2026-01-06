import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BrandedDownloadOptions {
  fileUrl: string;
  documentType: 'cv' | 'jd';
  entityName: string;
}

interface BrandedResponse {
  success: boolean;
  branded_pdf_base64?: string;
  branded_html?: string;
  original_pdf_base64?: string;
  original_file_base64?: string;
  original_file_name?: string;
  file_type?: string;
  branding_applied?: {
    logo_position: string;
    company_name: string | null;
    logo_url: string | null;
    has_org_logo: boolean;
    has_hiremetrics_logo: boolean;
  };
  error?: string;
}

export function useBrandedDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadBranded = async ({ fileUrl, documentType, entityName }: BrandedDownloadOptions) => {
    if (!fileUrl) {
      toast.error(`No ${documentType === 'cv' ? 'CV' : 'JD'} file available`);
      return;
    }

    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('brand-cv', {
        body: {
          file_url: fileUrl,
          document_type: documentType,
          entity_name: entityName
        }
      });

      if (error) throw error;

      const response = data as BrandedResponse;
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to brand document');
      }

      // Prefer real branded PDF when available
      if (response.file_type === 'pdf' && response.branded_pdf_base64) {
        downloadPdfBase64(response.branded_pdf_base64, entityName, documentType, true);
      } else if (response.file_type === 'pdf' && response.original_pdf_base64) {
        // Fallback (should be rare)
        downloadPdfBase64(response.original_pdf_base64, entityName, documentType, false);
      } else if (response.branded_html) {
        // For other files, download as HTML
        downloadAsHtml(response.branded_html, entityName, documentType);
      } else if (response.original_file_base64) {
        // Fallback: download original with branding info
        downloadOriginalWithBranding(response, entityName, documentType);
      }

      toast.success(`${documentType === 'cv' ? 'CV' : 'JD'} downloaded with branding`);
    } catch (error: any) {
      console.error('Branded download error:', error);
      toast.error(error.message || 'Failed to download branded document');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadPdfBase64 = (
    base64Data: string,
    entityName: string,
    documentType: 'cv' | 'jd',
    isBranded: boolean
  ) => {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityName.replace(/\s+/g, '_')}_${documentType.toUpperCase()}_${isBranded ? 'Branded' : 'Original'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF download failed:', e);
      toast.error('Failed to download PDF');
    }
  };

  const downloadAsHtml = (html: string, entityName: string, documentType: 'cv' | 'jd') => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName.replace(/\s+/g, '_')}_${documentType.toUpperCase()}_Branded.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadOriginalWithBranding = (
    response: BrandedResponse,
    entityName: string,
    documentType: 'cv' | 'jd'
  ) => {
    if (!response.original_file_base64) return;
    
    const binaryString = atob(response.original_file_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.original_file_name || `${entityName}_${documentType}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    downloadBranded,
    isDownloading
  };
}
