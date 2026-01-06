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

    // For PDFs, we'll create a branded HTML cover page that opens in a new window
    // with a print-ready layout, plus provide the original PDF download
    
    const brandedHtml = response.branded_html || '';
    
    // Create a new window with the branded cover and PDF viewer
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback: just download the original PDF
      downloadOriginalPdf(response.original_pdf_base64, entityName, documentType);
      return;
    }

    const orgLogoHtml = response.branding_applied?.logo_url
      ? `<img src="${response.branding_applied.logo_url}" alt="${response.branding_applied.company_name || 'Organization'}" style="max-height:50px;max-width:150px;object-fit:contain;" />`
      : (response.branding_applied?.company_name 
          ? `<div style="font-size:18px;font-weight:600;color:#00008B;">${response.branding_applied.company_name}</div>` 
          : '');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${documentType === 'cv' ? 'CV' : 'JD'} - ${entityName} (Branded)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; }
    .header-bar { background: #fff; border-bottom: 1px solid #e5e5e5; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .header-bar h1 { font-size: 16px; color: #333; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; }
    .btn-primary { background: #00008B; color: white; }
    .btn-outline { background: white; border: 1px solid #ddd; color: #333; margin-left: 8px; }
    .branded-section { background: white; max-width: 800px; margin: 24px auto; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .branded-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; margin-bottom: 24px; border-bottom: 2px solid #00008B; }
    .hiremetrics-logo { display: flex; align-items: center; gap: 10px; }
    .hiremetrics-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #00008B 0%, #1E3A8A 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; }
    .hiremetrics-text { font-size: 20px; font-weight: 700; color: #0F172A; }
    .doc-title { font-size: 28px; font-weight: 600; color: #00008B; text-align: center; margin: 32px 0; }
    .doc-subtitle { font-size: 14px; color: #666; text-align: center; margin-bottom: 24px; }
    .pdf-container { width: 100%; height: 80vh; border: 1px solid #ddd; border-radius: 4px; }
    .branded-footer { text-align: center; padding: 16px; font-size: 11px; color: #666; margin-top: 24px; border-top: 1px solid #eee; }
    @media print {
      .header-bar { display: none; }
      body { background: white; }
      .branded-section { box-shadow: none; margin: 0; max-width: none; }
      .pdf-container { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <h1>📄 ${entityName} - Branded ${documentType.toUpperCase()}</h1>
    <div>
      <button class="btn btn-primary" onclick="window.print()">Print Cover Page</button>
      <button class="btn btn-outline" onclick="downloadPdf()">Download Original PDF</button>
    </div>
  </div>

  <div class="branded-section">
    <div class="branded-header">
      <div class="hiremetrics-logo">
        <div class="hiremetrics-icon">H</div>
        <span class="hiremetrics-text">HireMetrics</span>
      </div>
      <div class="org-logo">${orgLogoHtml}</div>
    </div>
    
    <h2 class="doc-title">${entityName}</h2>
    <p class="doc-subtitle">${documentType === 'cv' ? 'Curriculum Vitae' : 'Job Description'}</p>
    
    <iframe class="pdf-container" src="data:application/pdf;base64,${response.original_pdf_base64}"></iframe>
    
    <div class="branded-footer">
      Generated via HireMetrics &bull; hiremetrics.co.uk
    </div>
  </div>

  <script>
    function downloadPdf() {
      const link = document.createElement('a');
      link.href = 'data:application/pdf;base64,${response.original_pdf_base64}';
      link.download = '${entityName.replace(/'/g, "\\'").replace(/\s+/g, '_')}_${documentType.toUpperCase()}.pdf';
      link.click();
    }
  </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const downloadOriginalPdf = (base64Data: string, entityName: string, documentType: 'cv' | 'jd') => {
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
      a.download = `${entityName.replace(/\s+/g, '_')}_${documentType.toUpperCase()}.pdf`;
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
