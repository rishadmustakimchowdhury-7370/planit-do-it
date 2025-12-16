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
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Invoice Preview
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="bg-white text-black p-8 rounded-lg" id="invoice-preview">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {invoice.company_logo ? (
                <img src={invoice.company_logo} alt="Company Logo" className="h-16 w-auto mb-2" />
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-[#0052CC] to-[#0052CC]/80 p-2">
                    <Briefcase className="text-white" size={24} />
                  </div>
                  <span className="text-2xl font-bold">
                    <span style={{ color: '#0052CC' }}>Recruitify</span>
                    <span style={{ color: '#6b7280' }}>CRM</span>
                  </span>
                </div>
              )}
              <div className="text-sm text-gray-600">
                {invoice.company_address && <p>{invoice.company_address}</p>}
                {invoice.company_phone && <p>Phone: {invoice.company_phone}</p>}
                <p>Email: {BRAND.email}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold text-gray-800">INVOICE</h1>
              <p className="text-lg font-semibold mt-2">{invoice.invoice_number}</p>
              <p className="text-sm text-gray-600">
                Date: {invoice.created_at ? format(new Date(invoice.created_at), 'MMMM d, yyyy') : 'N/A'}
              </p>
              {invoice.due_date && (
                <p className="text-sm text-gray-600">
                  Due: {format(new Date(invoice.due_date), 'MMMM d, yyyy')}
                </p>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
              <div className="text-gray-800">
                <p className="font-semibold">{tenant.name}</p>
                {user && (
                  <>
                    <p>{user.full_name}</p>
                    <p>{user.email}</p>
                    {user.phone && <p>{user.phone}</p>}
                    {user.address && <p>{user.address}</p>}
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Payment Info</h3>
              <div className="text-gray-800">
                <p>Currency: {invoice.currency}</p>
                <p className="text-lg font-bold mt-2">
                  Amount Due: {invoice.currency} ${Number(invoice.amount).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden mb-8">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Rate</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 ? (
                  invoice.line_items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-800">{item.description || 'Service'}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right">{item.quantity || 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right">
                        {invoice.currency} ${Number(item.rate || invoice.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right">
                        {invoice.currency} ${Number(item.amount || invoice.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-800">Subscription Service</td>
                    <td className="px-4 py-3 text-sm text-gray-800 text-right">1</td>
                    <td className="px-4 py-3 text-sm text-gray-800 text-right">
                      {invoice.currency} ${Number(invoice.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 text-right">
                      {invoice.currency} ${Number(invoice.amount).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{invoice.currency} ${Number(invoice.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">$0.00</span>
              </div>
              <div className="flex justify-between py-3 text-lg font-bold">
                <span>Total</span>
                <span>{invoice.currency} ${Number(invoice.amount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t mt-8 pt-6 text-center text-sm text-gray-500">
            <p>Thank you for your business!</p>
            <p className="mt-2">
              Questions? Contact us at support@recruitsy.com
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
