import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Printer, Download, Briefcase } from 'lucide-react';
import { BRAND } from '@/components/brand/Logo';

interface InvoicePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    invoice_number: string;
    amount: number;
    currency: string;
    due_date: string | null;
    notes: string | null;
    created_at: string | null;
    line_items?: any[];
    company_name?: string;
    company_address?: string;
    company_phone?: string;
    company_logo?: string;
  };
  tenant: {
    name: string;
  };
  user?: {
    full_name: string;
    email: string;
    phone?: string;
    address?: string;
  };
}

export function InvoicePreview({ open, onOpenChange, invoice, tenant, user }: InvoicePreviewProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = invoiceRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPDF = () => {
    // Use print dialog with "Save as PDF" option
    handlePrint();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Invoice Preview
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button size="sm" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div ref={invoiceRef} className="bg-white text-black" id="invoice-preview">
          {/* Modern Header with Gradient */}
          <div style={{ background: 'linear-gradient(to right, #0052CC, #0747A6)', color: 'white', padding: '32px', borderRadius: '8px 8px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {invoice.company_logo ? (
                  <img src={invoice.company_logo} alt="Company Logo" style={{ height: '56px', marginBottom: '12px', filter: 'brightness(0) invert(1)' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '10px' }}>
                      <Briefcase style={{ color: 'white' }} size={28} />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>
                      Recruitify<span style={{ fontWeight: '300', opacity: '0.8' }}>CRM</span>
                    </span>
                  </div>
                )}
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                  {invoice.company_address && <p>{invoice.company_address}</p>}
                  {invoice.company_phone && <p>Tel: {invoice.company_phone}</p>}
                  <p>Email: {BRAND.email}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '8px' }}>
                  <h1 style={{ fontSize: '36px', fontWeight: 'bold', letterSpacing: '-1px' }}>INVOICE</h1>
                </div>
                <div style={{ marginTop: '16px', color: 'rgba(255,255,255,0.9)' }}>
                  <p style={{ fontSize: '20px', fontWeight: '600' }}>{invoice.invoice_number}</p>
                  <p style={{ fontSize: '14px', marginTop: '4px' }}>
                    Issue Date: {invoice.created_at ? format(new Date(invoice.created_at), 'MMM d, yyyy') : 'N/A'}
                  </p>
                  {invoice.due_date && (
                    <p style={{ fontSize: '14px' }}>
                      Due Date: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '32px' }}>
            {/* Bill To & Payment Info Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #f3f4f6' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Bill To</h3>
                <div style={{ color: '#1f2937' }}>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>{tenant.name}</p>
                  {user && (
                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                      <p style={{ fontWeight: '500' }}>{user.full_name}</p>
                      <p style={{ color: '#6b7280' }}>{user.email}</p>
                      {user.phone && <p style={{ color: '#6b7280' }}>{user.phone}</p>}
                      {user.address && <p style={{ color: '#6b7280' }}>{user.address}</p>}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ background: 'linear-gradient(to bottom right, rgba(0,82,204,0.05), rgba(0,82,204,0.1))', borderRadius: '12px', padding: '20px', border: '1px solid rgba(0,82,204,0.2)' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#0052CC', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Amount Due</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#0052CC' }}>
                  £{Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                  Currency: GBP
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '32px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1f2937', color: 'white' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Description</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '14px', fontWeight: '600', width: '80px' }}>Qty</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', width: '120px' }}>Unit Price</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', width: '120px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 ? (
                    invoice.line_items.map((item: any, index: number) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                          {item.description || 'Service'}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>{item.quantity || 1}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280', textAlign: 'right' }}>
                          £{Number(item.rate || invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontWeight: '600', textAlign: 'right' }}>
                          £{Number(item.amount || invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                        Subscription Service - {tenant.name}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280', textAlign: 'right' }}>
                        £{Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontWeight: '600', textAlign: 'right' }}>
                        £{Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
              <div style={{ width: '320px', backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '12px' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontWeight: '500', color: '#1f2937' }}>
                    £{Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '12px' }}>
                  <span style={{ color: '#6b7280' }}>Tax (0%)</span>
                  <span style={{ fontWeight: '500', color: '#1f2937' }}>£0.00</span>
                </div>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>Total</span>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0052CC' }}>
                      £{Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div style={{ backgroundColor: '#fffbeb', borderRadius: '12px', padding: '20px', border: '1px solid #fde68a', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Notes</h3>
                <p style={{ fontSize: '14px', color: '#92400e' }}>{invoice.notes}</p>
              </div>
            )}

            {/* Payment Instructions */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #f3f4f6', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Payment Instructions</h3>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                <p>Please make payment within the due date to avoid service interruption.</p>
                <p>For questions about this invoice, contact us at {BRAND.email}</p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: '#0052CC', padding: '6px' }}>
                  <Briefcase style={{ color: 'white' }} size={16} />
                </div>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  <span style={{ color: '#0052CC' }}>Recruitify</span>
                  <span style={{ color: '#6b7280' }}>CRM</span>
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Thank you for your business!</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                {BRAND.email} • recruitifycrm.com
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}