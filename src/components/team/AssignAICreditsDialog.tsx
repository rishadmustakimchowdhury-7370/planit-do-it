import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

interface AssignAICreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    user_id: string;
    role: string;
    profile?: {
      full_name: string | null;
      email: string;
    };
    ai_credits_allocated?: number;
    ai_credits_used?: number;
  } | null;
  onSuccess: () => void;
}

export function AssignAICreditsDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
}: AssignAICreditsDialogProps) {
  const [credits, setCredits] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAssignCredits = async () => {
    if (!member) return;

    const creditsNum = parseInt(credits);
    if (isNaN(creditsNum) || creditsNum < 0) {
      toast.error('Please enter a valid number of credits');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({
          ai_credits_allocated: creditsNum,
        })
        .eq('id', member.id);

      if (error) throw error;

      toast.success(
        `Assigned ${creditsNum} AI testing credits to ${member.profile?.full_name || member.profile?.email}`
      );
      onOpenChange(false);
      setCredits('');
      onSuccess();
    } catch (error: any) {
      console.error('Error assigning credits:', error);
      toast.error(error.message || 'Failed to assign credits');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAllocated = member?.ai_credits_allocated || 0;
  const currentUsed = member?.ai_credits_used || 0;
  const remaining = currentAllocated - currentUsed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assign AI Testing Credits
          </DialogTitle>
          <DialogDescription>
            Allocate AI testing credits to {member?.profile?.full_name || member?.profile?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Currently Allocated</p>
                <p className="text-xl font-bold">{currentAllocated}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Used</p>
                <p className="text-xl font-bold text-muted-foreground">{currentUsed}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Remaining</p>
                <p className="text-xl font-bold text-success">{remaining}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credits">New Allocation</Label>
            <Input
              id="credits"
              type="number"
              min="0"
              placeholder="Enter number of credits"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAssignCredits();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              This will replace the current allocation. The user has already used {currentUsed} credits.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setCredits('');
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleAssignCredits} disabled={isSubmitting}>
            {isSubmitting ? 'Assigning...' : 'Assign Credits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
