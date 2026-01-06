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
  branded_html?: string;
  original_pdf_base64?: string;
  original_file_base64?: string;
  original_file_name?: string;
  file_type?: string;
  branding_applied?: {
    logo_position: string;
    company_name: string | null;
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

      // For PDF files, create a combined document
      if (response.file_type === 'pdf' && response.branded_html && response.original_pdf_base64) {
        await downloadBrandedPdf(response, entityName, documentType);
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

  const downloadBrandedPdf = async (
    response: BrandedResponse,
    entityName: string,
    documentType: 'cv' | 'jd'
  ) => {
    if (!response.original_pdf_base64) {
      toast.error('No PDF data available');
      return;
    }

    // Convert base64 to blob and create object URL
    const binaryString = atob(response.original_pdf_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
    const pdfDataUrl = URL.createObjectURL(pdfBlob);

    // Open new window first
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to view branded document');
      URL.revokeObjectURL(pdfDataUrl);
      return;
    }

    // Write the HTML content
    const brandedContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${documentType === 'cv' ? 'CV' : 'Job Description'} - ${entityName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; flex-direction: column; }
    .branded-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      border-bottom: 2px solid #0B1C8C;
      background: white;
      flex-shrink: 0;
    }
    .hiremetrics-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .hiremetrics-icon {
      width: 32px;
      height: 32px;
      background: #0B1C8C;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 16px;
    }
    .hiremetrics-text {
      font-size: 14px;
      font-weight: 600;
      color: #0B1C8C;
    }
    .org-logo img {
      max-height: 36px;
      max-width: 120px;
      object-fit: contain;
    }
    .org-name {
      font-size: 14px;
      font-weight: 600;
      color: #0B1C8C;
    }
    .pdf-container {
      flex: 1;
      width: 100%;
      min-height: 0;
    }
    .pdf-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div class="branded-header">
    <div class="hiremetrics-logo">
      <div class="hiremetrics-icon">H</div>
      <span class="hiremetrics-text">HireMetrics</span>
    </div>
    <div class="org-logo">
      ${response.branding_applied?.company_name 
        ? `<span class="org-name">${response.branding_applied.company_name}</span>`
        : ''
      }
    </div>
  </div>
  
  <div class="pdf-container">
    <iframe id="pdfFrame"></iframe>
  </div>
  
  <script>
    document.getElementById('pdfFrame').src = '${pdfDataUrl}';
  </script>
</body>
</html>`;

    printWindow.document.write(brandedContent);
    printWindow.document.close();
    
    // Clean up blob URL after a delay to allow loading
    setTimeout(() => {
      URL.revokeObjectURL(pdfDataUrl);
    }, 60000);
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
