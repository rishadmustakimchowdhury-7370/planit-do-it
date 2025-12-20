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
      {/* Background circle with gradient feel */}
      <circle cx="16" cy="16" r="14" fill="currentColor" fillOpacity="0.1" />
      
      {/* Rising chart bars */}
      <rect x="6" y="20" width="4" height="6" rx="1" fill="currentColor" />
      <rect x="12" y="14" width="4" height="12" rx="1" fill="currentColor" />
      <rect x="18" y="8" width="4" height="18" rx="1" fill="currentColor" />
      
      {/* Target/checkmark circle */}
      <circle cx="24" cy="8" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="24" cy="8" r="2" fill="currentColor" />
      
      {/* Connecting upward arrow line */}
      <path
        d="M8 18 L14 12 L20 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 2"
        opacity="0.6"
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
          <span className={cn('font-heading font-bold tracking-tight leading-none', config.text, textColor)}>
            <span className="text-primary">Hire</span>
            <span className="text-secondary">Metrics</span>
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase mt-0.5">
              Recruitment Performance OS
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoText({ className }: { className?: string }) {
  return (
    <span className={cn('font-heading font-bold', className)}>
      <span className="text-primary">Hire</span>
      <span className="text-secondary">Metrics</span>
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
      <span className={cn('font-heading font-bold tracking-tight', config.text)}>
        <span className="text-primary">Hire</span>
        <span className="text-secondary">Metrics</span>
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
      <div style="background: linear-gradient(135deg, hsl(210, 100%, 35%) 0%, hsl(210, 100%, 45%) 100%); border-radius: 12px; padding: 8px; display: flex; align-items: center; justify-content: center;">
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="white" fill-opacity="0.1"/>
          <rect x="6" y="20" width="4" height="6" rx="1" fill="white"/>
          <rect x="12" y="14" width="4" height="12" rx="1" fill="white"/>
          <rect x="18" y="8" width="4" height="18" rx="1" fill="white"/>
          <circle cx="24" cy="8" r="5" stroke="white" stroke-width="2" fill="none"/>
          <circle cx="24" cy="8" r="2" fill="white"/>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column;">
        <span style="font-family: 'Poppins', Arial, sans-serif; font-weight: 700; font-size: ${fontSize}; line-height: 1;">
          <span style="color: hsl(210, 100%, 35%);">Hire</span><span style="color: hsl(152, 69%, 40%);">Metrics</span>
        </span>
        <span style="font-family: Arial, sans-serif; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
          Recruitment Performance OS
        </span>
      </div>
    </div>
  `;
}

export const BRAND = {
  name: 'HireMetrics',
  fullName: 'HireMetrics - Recruitment Performance OS',
  shortName: 'HireMetrics',
  tagline: 'Track Work. Prove Performance. Hire Better.',
  category: 'Recruitment Performance OS',
  email: 'info@hiremetrics.io',
  supportEmail: 'support@hiremetrics.io',
  website: 'https://hiremetrics.io',
} as const;