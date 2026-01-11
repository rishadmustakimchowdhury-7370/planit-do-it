import { useEffect } from 'react';
import { useSiteBranding } from '@/hooks/useSiteBranding';

export function DynamicHead() {
  const { branding, seo, isLoading } = useSiteBranding();

  useEffect(() => {
    if (isLoading) return;

    // Update favicon
    if (branding?.favicon_url) {
      const existingFavicon = document.querySelector('link[rel="icon"]');
      if (existingFavicon) {
        existingFavicon.setAttribute('href', branding.favicon_url);
      } else {
        const newFavicon = document.createElement('link');
        newFavicon.rel = 'icon';
        newFavicon.href = branding.favicon_url;
        document.head.appendChild(newFavicon);
      }
    }

    // Update site title
    if (branding?.site_title) {
      document.title = branding.site_title;
    }

    // Update meta description
    if (branding?.meta_description) {
      updateMetaTag('description', branding.meta_description);
    }

    // Update Google verification
    if (seo?.google_verification_meta) {
      updateMetaTag('google-site-verification', seo.google_verification_meta);
    }

    // Update Bing verification
    if (seo?.bing_verification_meta) {
      updateMetaTag('msvalidate.01', seo.bing_verification_meta);
    }

    // Update Open Graph tags
    if (seo?.og_title) {
      updateMetaTag('og:title', seo.og_title, 'property');
    }
    if (seo?.og_description) {
      updateMetaTag('og:description', seo.og_description, 'property');
    }
    if (seo?.og_image) {
      updateMetaTag('og:image', seo.og_image, 'property');
    }

    // Update Twitter card
    if (seo?.twitter_card) {
      updateMetaTag('twitter:card', seo.twitter_card);
    }
    if (seo?.twitter_site) {
      updateMetaTag('twitter:site', seo.twitter_site);
    }
    if (seo?.og_title) {
      updateMetaTag('twitter:title', seo.og_title);
    }
    if (seo?.og_description) {
      updateMetaTag('twitter:description', seo.og_description);
    }

    // Update canonical URL
    if (seo?.canonical_url) {
      const existingCanonical = document.querySelector('link[rel="canonical"]');
      if (existingCanonical) {
        existingCanonical.setAttribute('href', seo.canonical_url);
      } else {
        const newCanonical = document.createElement('link');
        newCanonical.rel = 'canonical';
        newCanonical.href = seo.canonical_url;
        document.head.appendChild(newCanonical);
      }
    }

    // Update JSON-LD schema
    if (seo?.json_ld_schema) {
      const existingSchema = document.querySelector('script[type="application/ld+json"]');
      if (existingSchema) {
        existingSchema.textContent = seo.json_ld_schema;
      } else {
        try {
          // Validate it's valid JSON before adding
          JSON.parse(seo.json_ld_schema);
          const newSchema = document.createElement('script');
          newSchema.type = 'application/ld+json';
          newSchema.textContent = seo.json_ld_schema;
          document.head.appendChild(newSchema);
        } catch (e) {
          console.error('Invalid JSON-LD schema:', e);
        }
      }
    }

    // Inject chat widget script
    if (branding?.chat_widget_script) {
      const existingChatWidget = document.getElementById('dynamic-chat-widget');
      if (!existingChatWidget) {
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'dynamic-chat-widget';
        widgetContainer.innerHTML = branding.chat_widget_script;
        document.body.appendChild(widgetContainer);

        // Execute any scripts in the widget
        const scripts = widgetContainer.querySelectorAll('script');
        scripts.forEach((script) => {
          const newScript = document.createElement('script');
          if (script.src) {
            newScript.src = script.src;
          } else {
            newScript.textContent = script.textContent;
          }
          document.body.appendChild(newScript);
        });
      }
    }
  }, [branding, seo, isLoading]);

  // Helper function to update or create meta tags
  function updateMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
    const selector = attribute === 'property' 
      ? `meta[property="${name}"]` 
      : `meta[name="${name}"]`;
    
    let metaTag = document.querySelector(selector);
    
    if (metaTag) {
      metaTag.setAttribute('content', content);
    } else {
      metaTag = document.createElement('meta');
      metaTag.setAttribute(attribute, name);
      metaTag.setAttribute('content', content);
      document.head.appendChild(metaTag);
    }
  }

  // This component doesn't render anything visible
  return null;
}
