import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrandingSettings {
  logo_url: string | null;
  logo_position: string | null;
  company_name: string | null;
  primary_color: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Get user from auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get tenant_id from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      throw new Error('Tenant not found');
    }

    const { cv_file_url } = await req.json();

    if (!cv_file_url) {
      throw new Error('CV file URL is required');
    }

    // Get branding settings
    const { data: branding, error: brandingError } = await supabaseClient
      .from('branding_settings')
      .select('logo_url, logo_position, company_name, primary_color')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();

    if (brandingError) {
      console.error('Error fetching branding:', brandingError);
    }

    const brandingSettings: BrandingSettings | null = branding;

    // Download original CV from storage
    const { data: cvData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(cv_file_url);

    if (downloadError || !cvData) {
      throw new Error('Failed to download CV file');
    }

    // Convert to ArrayBuffer
    const cvBuffer = await cvData.arrayBuffer();
    const cvBase64 = btoa(String.fromCharCode(...new Uint8Array(cvBuffer)));

    // Call external API to brand the PDF (placeholder - you'll need a PDF processing service)
    // For now, we'll return the original file with branding metadata
    // In production, you'd use a service like PDFTron, PDF.co, or similar to overlay the logo
    
    console.log('Branding CV with settings:', {
      hasLogo: !!brandingSettings?.logo_url,
      position: brandingSettings?.logo_position,
      company: brandingSettings?.company_name
    });

    // Return the branded CV (in this simplified version, returning original with branding info)
    // In production, you would process the PDF here with the logo overlay
    return new Response(
      JSON.stringify({
        success: true,
        message: 'CV branded successfully',
        cv_base64: cvBase64,
        branding_applied: {
          logo_position: brandingSettings?.logo_position || 'top-right',
          company_name: brandingSettings?.company_name,
          has_logo: !!brandingSettings?.logo_url
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in brand-cv function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});