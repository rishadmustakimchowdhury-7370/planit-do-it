import { useState } from 'react';
import { Candidate, PipelineStage } from '@/types/recruitment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { SendEmailDialog } from '@/components/communication/SendEmailDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MapPin, Mail, Calendar, Linkedin, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { openWhatsAppChat, formatWhatsAppNumber } from '@/lib/whatsapp';
import { toast } from 'sonner';

interface CandidateCardProps {
  candidate: Candidate;
  showMatchScore?: boolean;
  compact?: boolean;
}

const statusColors: Record<PipelineStage, string> = {
  new: 'bg-muted text-muted-foreground',
  screening: 'bg-info/10 text-info border-info/30',
  shortlisted: 'bg-warning/10 text-warning border-warning/30',
  interview: 'bg-accent/10 text-accent border-accent/30',
  offer: 'bg-success/10 text-success border-success/30',
  placed: 'bg-success/20 text-success border-success/40',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};

const statusLabels: Record<PipelineStage, string> = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  placed: 'Placed',
  rejected: 'Rejected',
};

export function CandidateCard({ candidate, showMatchScore = true, compact = false }: CandidateCardProps) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-lg border border-border p-3 hover:shadow-md hover:border-accent/30 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={candidate.avatar} alt={candidate.name} />
            <AvatarFallback className="text-xs bg-accent/10 text-accent">
              {candidate.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{candidate.name}</p>
            <p className="text-xs text-muted-foreground truncate">{candidate.currentTitle}</p>
          </div>
          {showMatchScore && candidate.matchScore && (
            <MatchScoreCircle score={candidate.matchScore} size="sm" showLabel={false} />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <Link
          to={`/candidates/${candidate.id}`}
          className="block bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-accent/30 transition-all"
        >
          <div className="flex items-start gap-4">
            <Avatar className="w-14 h-14">
              <AvatarImage src={candidate.avatar} alt={candidate.name} />
              <AvatarFallback className="text-lg bg-accent/10 text-accent font-medium">
                {candidate.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{candidate.name}</h3>
                  <p className="text-sm text-accent">{candidate.currentTitle}</p>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn('text-xs capitalize whitespace-nowrap', statusColors[candidate.status])}
                >
                  {statusLabels[candidate.status]}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {candidate.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {candidate.experienceYears} years exp.
                </span>
              </div>
              
              {/* Quick Action Icons */}
              <div className="flex items-center gap-1 mt-3" onClick={(e) => e.preventDefault()}>
                {candidate.linkedinUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(candidate.linkedinUrl, '_blank');
                    }}
                    title="View LinkedIn Profile"
                  >
                    <Linkedin className="h-4 w-4 text-[#0077B5]" />
                  </Button>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 transition-all duration-200",
                          formatWhatsAppNumber(candidate.phone) 
                            ? "hover:bg-green-100 hover:text-green-600 active:scale-95" 
                            : "opacity-50 cursor-not-allowed"
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!formatWhatsAppNumber(candidate.phone)) {
                            toast.error('WhatsApp number not added');
                            return;
                          }
                          openWhatsAppChat(candidate.phone);
                        }}
                      >
                        <MessageCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatWhatsAppNumber(candidate.phone) 
                        ? 'Open WhatsApp chat' 
                        : 'WhatsApp number not added'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEmailDialogOpen(true);
                  }}
                  title="Send Email"
                >
                  <Mail className="h-4 w-4 text-info" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mt-2">
                {candidate.skills.slice(0, 4).map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs bg-muted/50">
                    {skill}
                  </Badge>
                ))}
                {candidate.skills.length > 4 && (
                  <Badge variant="secondary" className="text-xs bg-muted/50">
                    +{candidate.skills.length - 4}
                  </Badge>
                )}
              </div>
            </div>
            
            {showMatchScore && candidate.matchScore && (
              <div className="flex-shrink-0">
                <MatchScoreCircle score={candidate.matchScore} size="md" />
              </div>
            )}
          </div>
        </Link>
      </motion.div>

      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        recipientEmail={candidate.email}
        recipientName={candidate.name}
        context="candidate"
        contextData={{ candidateName: candidate.name }}
      />
    </>
  );
}
