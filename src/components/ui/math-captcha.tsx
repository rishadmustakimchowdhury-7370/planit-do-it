import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MathCaptchaProps {
  onVerified: (verified: boolean) => void;
  label?: string;
  className?: string;
}

export function MathCaptcha({ onVerified, label = "Verify you're human", className }: MathCaptchaProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState<'+' | '-'>('+');
  const [userAnswer, setUserAnswer] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  const generateProblem = useCallback(() => {
    const newNum1 = Math.floor(Math.random() * 10) + 1;
    const newNum2 = Math.floor(Math.random() * 10) + 1;
    const newOperator = Math.random() > 0.5 ? '+' : '-';
    
    // Ensure no negative results for subtraction
    if (newOperator === '-' && newNum2 > newNum1) {
      setNum1(newNum2);
      setNum2(newNum1);
    } else {
      setNum1(newNum1);
      setNum2(newNum2);
    }
    setOperator(newOperator);
    setUserAnswer('');
    setIsVerified(false);
    setHasAttempted(false);
    onVerified(false);
  }, [onVerified]);

  useEffect(() => {
    generateProblem();
  }, [generateProblem]);

  const correctAnswer = operator === '+' ? num1 + num2 : num1 - num2;

  const handleAnswerChange = (value: string) => {
    setUserAnswer(value);
    setHasAttempted(true);
    
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue === correctAnswer) {
      setIsVerified(true);
      onVerified(true);
    } else {
      setIsVerified(false);
      onVerified(false);
    }
  };

  const isWrong = hasAttempted && userAnswer !== '' && !isVerified;

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm">{label} *</Label>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border font-mono text-lg">
          <span className="font-semibold">{num1}</span>
          <span className="text-primary font-bold">{operator}</span>
          <span className="font-semibold">{num2}</span>
          <span className="text-muted-foreground">=</span>
        </div>
        <Input
          type="number"
          value={userAnswer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="?"
          className={cn(
            "w-20 h-10 text-center font-mono text-lg",
            isVerified && "border-green-500 bg-green-50 dark:bg-green-950/20",
            isWrong && "border-destructive bg-destructive/5"
          )}
          required
        />
        {isVerified && (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        )}
        {isWrong && (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10">
            <X className="h-4 w-4 text-destructive" />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={generateProblem}
          className="h-8 w-8"
          title="New problem"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {isWrong && (
        <p className="text-xs text-destructive">Incorrect answer. Please try again.</p>
      )}
      {isVerified && (
        <p className="text-xs text-green-600 dark:text-green-400">Verified!</p>
      )}
    </div>
  );
}
