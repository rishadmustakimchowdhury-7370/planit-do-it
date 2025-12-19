import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Plus, RefreshCw } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

export function CreditsDisplay() {
  const { balance, isLoading, refreshBalance } = useCredits();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  const isLow = balance < 10;
  const isCritical = balance < 5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Coins className="h-4 w-4 text-warning" />
            Credits
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshBalance}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">
            {balance}
            {isLow && (
              <Badge 
                variant={isCritical ? 'destructive' : 'secondary'} 
                className="ml-2 text-xs"
              >
                {isCritical ? 'Critical' : 'Low'}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/billing')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Buy Credits
          </Button>
        </div>
        <CardDescription className="mt-2 text-xs">
          AI features cost credits per use
        </CardDescription>
      </CardContent>
    </Card>
  );
}
