import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  StickyNote, 
  DollarSign, 
  MessageSquare, 
  Building2, 
  Save, 
  Loader2,
  Plus,
  Trash2,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface CandidateNote {
  id: string;
  type: 'general' | 'salary' | 'feedback' | 'client';
  content: string;
  created_at: string;
  created_by?: string;
}

interface CandidateNotesPanelProps {
  candidateId: string;
  candidateName: string;
  existingNotes: string | null;
  privateNotes: string | null;
  onNotesUpdate?: () => void;
}

export function CandidateNotesPanel({ 
  candidateId, 
  candidateName,
  existingNotes,
  privateNotes,
  onNotesUpdate
}: CandidateNotesPanelProps) {
  const { user, tenantId, profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState(existingNotes || '');
  const [salaryNotes, setSalaryNotes] = useState('');
  const [clientFeedback, setClientFeedback] = useState('');
  const [internalNotes, setInternalNotes] = useState(privateNotes || '');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [currentSalary, setCurrentSalary] = useState('');
  
  // Parse existing notes to extract structured data
  useEffect(() => {
    if (existingNotes) {
      try {
        // Try to parse structured notes from JSON in the notes field
        const parsed = JSON.parse(existingNotes);
        if (parsed.salary) setSalaryNotes(parsed.salary);
        if (parsed.clientFeedback) setClientFeedback(parsed.clientFeedback);
        if (parsed.expectedSalary) setExpectedSalary(parsed.expectedSalary);
        if (parsed.currentSalary) setCurrentSalary(parsed.currentSalary);
        if (parsed.general) setNotes(parsed.general);
      } catch {
        // Not JSON, use as plain notes
        setNotes(existingNotes);
      }
    }
    if (privateNotes) {
      setInternalNotes(privateNotes);
    }
  }, [existingNotes, privateNotes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Structure the notes as JSON for better organization
      const structuredNotes = JSON.stringify({
        general: notes,
        salary: salaryNotes,
        clientFeedback: clientFeedback,
        expectedSalary: expectedSalary,
        currentSalary: currentSalary,
        lastUpdated: new Date().toISOString(),
        updatedBy: profile?.full_name || user?.email,
      });

      const { error } = await supabase
        .from('candidates')
        .update({ 
          notes: structuredNotes,
          private_notes: internalNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      if (error) throw error;

      // Log activity
      await supabase.from('activities').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action: 'Updated candidate notes',
        entity_type: 'candidate',
        entity_id: candidateId,
        entity_name: candidateName,
      });

      toast.success('Notes saved successfully');
      onNotesUpdate?.();
    } catch (error: any) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Salary Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-success" />
            Salary Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentSalary">Current Salary</Label>
              <Input
                id="currentSalary"
                placeholder="e.g., $80,000/year"
                value={currentSalary}
                onChange={(e) => setCurrentSalary(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedSalary">Expected Salary</Label>
              <Input
                id="expectedSalary"
                placeholder="e.g., $100,000 - $120,000"
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="salaryNotes">Salary Notes</Label>
            <Textarea
              id="salaryNotes"
              placeholder="Additional salary details, negotiation notes, benefits expectations..."
              value={salaryNotes}
              onChange={(e) => setSalaryNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Client Feedback */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-info" />
            Client Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Record feedback from clients about this candidate, interview impressions, hiring manager comments..."
            value={clientFeedback}
            onChange={(e) => setClientFeedback(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* General Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-warning" />
            General Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="General observations, personality traits, communication skills, availability, relocation preferences..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Private/Internal Notes */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-destructive" />
              Private Notes
            </CardTitle>
            <Badge variant="outline" className="text-xs">Internal Only</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Confidential notes not shared with clients or candidates. Red flags, internal assessments, sensitive information..."
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={4}
            className="border-dashed"
          />
          <p className="text-xs text-muted-foreground mt-2">
            These notes are private and will not be visible to clients or candidates.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save All Notes
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
