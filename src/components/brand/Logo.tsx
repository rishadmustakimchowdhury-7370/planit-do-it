import { Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'default' | 'light' | 'dark';
  className?: string;
}

const sizeConfig = {
  sm: { icon: 16, text: 'text-sm' },
  md: { icon: 20, text: 'text-lg' },
  lg: { icon: 24, text: 'text-xl' },
  xl: { icon: 32, text: 'text-2xl' },
};

export function Logo({ size = 'md', showText = true, variant = 'default', className }: LogoProps) {
  const config = sizeConfig[size];
  
  const textColor = {
    default: 'text-foreground',
    light: 'text-white',
    dark: 'text-foreground',
  }[variant];

  const iconColor = {
    default: 'text-primary',
    light: 'text-white',
    dark: 'text-primary',
  }[variant];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 p-1.5',
        variant === 'light' && 'bg-white/20'
      )}>
        <Briefcase className={cn('text-white', iconColor === 'text-white' && 'text-white')} size={config.icon} />
      </div>
      {showText && (
        <span className={cn('font-bold tracking-tight', config.text, textColor)}>
          <span className="text-primary">Recruitify</span>
          <span className="text-muted-foreground font-medium">CRM</span>
        </span>
      )}
    </div>
  );
}

export function LogoText({ className }: { className?: string }) {
  return (
    <span className={cn('font-bold', className)}>
      <span className="text-primary">Recruitify</span>
      <span className="text-muted-foreground font-medium">CRM</span>
    </span>
  );
}

// For emails and invoices - returns HTML string
export function getLogoHTML(options?: { size?: 'sm' | 'md' | 'lg' }) {
  const size = options?.size || 'md';
  const fontSize = size === 'sm' ? '16px' : size === 'lg' ? '24px' : '20px';
  
  return `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="background: linear-gradient(135deg, #0052CC 0%, #0052CC80 100%); border-radius: 8px; padding: 6px; display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size === 'sm' ? '16' : size === 'lg' ? '24' : '20'}" height="${size === 'sm' ? '16' : size === 'lg' ? '24' : '20'}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          <rect width="20" height="14" x="2" y="6" rx="2"/>
        </svg>
      </div>
      <span style="font-family: Arial, sans-serif; font-weight: bold; font-size: ${fontSize};">
        <span style="color: #0052CC;">Recruitify</span><span style="color: #6b7280; font-weight: 500;">CRM</span>
      </span>
    </div>
  `;
}

export const BRAND = {
  name: 'Recruitify CRM',
  shortName: 'Recruitify',
  email: 'info@recruitifycrm.com',
  supportEmail: 'support@recruitifycrm.com',
  website: 'https://recruitifycrm.com',
  tagline: 'AI-Powered Recruitment Platform',
} as const;
