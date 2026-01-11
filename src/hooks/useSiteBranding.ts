import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SiteBranding {
  site_title: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  meta_description: string | null;
  social_links: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  } | null;
  chat_widget_script: string | null;
}

interface SEOSettings {
  google_verification_meta: string;
  bing_verification_meta: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_card: string;
  twitter_site: string;
  json_ld_schema: string;
}

export interface SiteSettings {
  branding: SiteBranding | null;
  seo: SEOSettings | null;
  isLoading: boolean;
}

export function useSiteBranding(): SiteSettings {
  const [branding, setBranding] = useState<SiteBranding | null>(null);
  const [seo, setSeo] = useState<SEOSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch branding settings
        const { data: brandingData } = await supabase
          .from('site_branding')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (brandingData) {
          setBranding({
            site_title: brandingData.site_title,
            logo_url: brandingData.logo_url,
            favicon_url: brandingData.favicon_url,
            primary_color: brandingData.primary_color,
            secondary_color: brandingData.secondary_color,
            meta_description: brandingData.meta_description,
            social_links: brandingData.social_links as any,
            chat_widget_script: brandingData.chat_widget_script,
          });
        }

        // Fetch SEO settings
        const { data: seoData } = await supabase
          .from('platform_settings')
          .select('*')
          .eq('key', 'seo_settings')
          .maybeSingle();

        if (seoData?.value) {
          setSeo(seoData.value as unknown as SEOSettings);
        }
      } catch (error) {
        console.error('Failed to fetch site settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();

    // Subscribe to realtime updates for branding
    const brandingChannel = supabase
      .channel('site_branding_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_branding' },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    // Subscribe to realtime updates for SEO settings
    const seoChannel = supabase
      .channel('seo_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_settings', filter: 'key=eq.seo_settings' },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(brandingChannel);
      supabase.removeChannel(seoChannel);
    };
  }, []);

  return { branding, seo, isLoading };
}
