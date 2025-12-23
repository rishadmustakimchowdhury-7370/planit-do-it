import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'default' | 'light' | 'dark';
  className?: string;
}

const sizeConfig = {
  sm: { icon: 20, text: 'text-sm', padding: 'p-1' },
  md: { icon: 24, text: 'text-lg', padding: 'p-1.5' },
  lg: { icon: 28, text: 'text-xl', padding: 'p-2' },
  xl: { icon: 36, text: 'text-2xl', padding: 'p-2.5' },
};

// Custom HireMetrics Icon - Chart + Target combined
function HireMetricsIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rising chart bars */}
      <rect x="4" y="20" width="5" height="8" rx="1.5" fill="currentColor" opacity="0.6" />
      <rect x="11" y="14" width="5" height="14" rx="1.5" fill="currentColor" opacity="0.8" />
      <rect x="18" y="6" width="5" height="22" rx="1.5" fill="currentColor" />
      
      {/* Target/bullseye */}
      <circle cx="25" cy="7" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="25" cy="7" r="1.5" fill="currentColor" />
      
      {/* Trend line */}
      <path
        d="M6 19 L13 13 L20 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
    </svg>
  );
}

export function Logo({ size = 'md', showText = true, variant = 'default', className }: LogoProps) {
  const config = sizeConfig[size];
  
  const textColor = {
    default: 'text-foreground',
    light: 'text-white',
    dark: 'text-foreground',
  }[variant];

  const iconColor = {
    default: 'text-primary-foreground',
    light: 'text-white',
    dark: 'text-primary-foreground',
  }[variant];

  const bgClass = {
    default: 'bg-gradient-to-br from-primary to-primary/80',
    light: 'bg-white/20',
    dark: 'bg-gradient-to-br from-primary to-primary/80',
  }[variant];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-xl',
        bgClass,
        config.padding
      )}>
        <HireMetricsIcon size={config.icon} className={iconColor} />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn('font-semibold tracking-tight leading-none', config.text, textColor)}>
            Hiremetrics
          </span>
          {size !== 'sm' && (
            <span className={cn(
              "text-[10px] font-medium tracking-wide uppercase mt-0.5",
              variant === 'light' ? 'text-white/70' : 'text-muted-foreground'
            )}>
              Recruitment Analytics
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoText({ className }: { className?: string }) {
  return (
    <span className={cn('font-heading font-bold text-foreground', className)}>
      Hiremetrics
    </span>
  );
}

// Compact logo for tight spaces
export function LogoCompact({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const config = sizeConfig[size];
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80',
        config.padding
      )}>
        <HireMetricsIcon size={config.icon} className="text-primary-foreground" />
      </div>
      <span className={cn('font-heading font-bold tracking-tight text-foreground', config.text)}>
        Hiremetrics
      </span>
    </div>
  );
}

// For emails and invoices - returns HTML string
export function getLogoHTML(options?: { size?: 'sm' | 'md' | 'lg' }) {
  const size = options?.size || 'md';
  const fontSize = size === 'sm' ? '16px' : size === 'lg' ? '24px' : '20px';
  const iconSize = size === 'sm' ? '20' : size === 'lg' ? '28' : '24';
  
  return `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); border-radius: 12px; padding: 8px; display: flex; align-items: center; justify-content: center;">
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="20" width="5" height="8" rx="1.5" fill="white" opacity="0.6"/>
          <rect x="11" y="14" width="5" height="14" rx="1.5" fill="white" opacity="0.8"/>
          <rect x="18" y="6" width="5" height="22" rx="1.5" fill="white"/>
          <circle cx="25" cy="7" r="4.5" stroke="white" stroke-width="2" fill="none"/>
          <circle cx="25" cy="7" r="1.5" fill="white"/>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column;">
        <span style="font-family: 'Poppins', Arial, sans-serif; font-weight: 700; font-size: ${fontSize}; line-height: 1; color: #0F172A;">
          Hiremetrics
        </span>
        <span style="font-family: Arial, sans-serif; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
          Recruitment Analytics
        </span>
      </div>
    </div>
  `;
}

export const BRAND = {
  name: 'Hiremetrics',
  fullName: 'Hiremetrics - Recruitment Analytics Platform',
  shortName: 'Hiremetrics',
  tagline: 'Measure What Matters. Hire Smarter.',
  category: 'Recruitment Analytics',
  email: 'info@hiremetrics.io',
  supportEmail: 'support@hiremetrics.io',
  website: 'https://hiremetrics.io',
} as const;