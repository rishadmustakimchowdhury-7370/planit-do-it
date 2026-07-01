import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  label?: string;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Prevents a single failing subtree from blanking the entire page.
 * Logs details to the console; renders a compact retry card in place.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Developer-only detail: never surface stack traces in the UI.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    const err = this.state.error;
    const isDev = import.meta.env.DEV;
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 flex items-start gap-4">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {this.props.label ? `${this.props.label} failed to load.` : 'Component failed to load.'}
          </div>
          {isDev ? (
            <>
              <p className="text-sm text-destructive mt-1 font-mono break-words">
                {err.name}: {err.message}
              </p>
              {err.stack && (
                <pre className="mt-2 max-h-64 overflow-auto text-[11px] leading-snug text-muted-foreground bg-background/60 p-2 rounded border whitespace-pre-wrap break-words">
                  {err.stack}
                </pre>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              This section couldn't render. You can retry or continue using the rest of the page.
            </p>
          )}
          <Button size="sm" variant="outline" className="mt-3" onClick={this.reset}>
            <RefreshCcw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
