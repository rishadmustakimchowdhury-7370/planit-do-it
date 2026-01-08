import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base32 encoding for TOTP secrets
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateSecret(length = 20): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let secret = "";
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_CHARS[bytes[i] % 32];
  }
  return secret;
}

function base32Decode(str: string): Uint8Array {
  str = str.toUpperCase().replace(/=+$/, "");
  const output: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  
  for (const char of str) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      output.push((buffer >> bitsLeft) & 0xff);
    }
  }
  
  return new Uint8Array(output);
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  // Create a new ArrayBuffer from the Uint8Array to avoid SharedArrayBuffer issues
  const keyBuffer = new ArrayBuffer(key.length);
  new Uint8Array(keyBuffer).set(key);
  
  const messageBuffer = new ArrayBuffer(message.length);
  new Uint8Array(messageBuffer).set(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageBuffer);
  return new Uint8Array(signature);
}

async function generateTOTP(secret: string, timeStep = 30, digits = 6): Promise<string> {
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / timeStep);
  
  const timeBytes = new Uint8Array(8);
  let temp = time;
  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  
  const hmac = await hmacSha1(key, timeBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % Math.pow(10, digits);
  
  return code.toString().padStart(digits, "0");
}

async function verifyTOTP(secret: string, token: string, window = 1): Promise<boolean> {
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000 / timeStep);
  
  for (let i = -window; i <= window; i++) {
    const time = currentTime + i;
    const timeBytes = new Uint8Array(8);
    let temp = time;
    for (let j = 7; j >= 0; j--) {
      timeBytes[j] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }
    
    const key = base32Decode(secret);
    const hmac = await hmacSha1(key, timeBytes);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;
    
    if (code.toString().padStart(6, "0") === token) {
      return true;
    }
  }
  
  return false;
}

function generateQRCodeURL(secret: string, email: string, issuer = "HireMetrics"): string {
  const otpAuthURL = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthURL)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, code, secret, email } = body;
    console.log(`TOTP 2FA action: ${action}`);

    // Actions that don't require authentication (pre-login checks)
    if (action === "check-2fa-status") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("two_factor_enabled")
        .eq("email", email)
        .single();

      return new Response(JSON.stringify({ 
        two_factor_enabled: profile?.two_factor_enabled || false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-login") {
      if (!email || !code) {
        return new Response(JSON.stringify({ error: "Email and code required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("two_factor_secret, two_factor_enabled")
        .eq("email", email)
        .single();

      if (!profile?.two_factor_enabled || !profile?.two_factor_secret) {
        return new Response(JSON.stringify({ error: "2FA not enabled for this user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isValid = await verifyTOTP(profile.two_factor_secret, code);
      
      if (!isValid) {
        console.log("Invalid TOTP code for login");
        return new Response(JSON.stringify({ success: false, error: "Invalid verification code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Login TOTP verified successfully");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`TOTP 2FA action: ${action} for user: ${user.id}`);

    if (action === "setup") {
      // Generate a new secret for setup
      const newSecret = generateSecret(20);
      const qrCodeURL = generateQRCodeURL(newSecret, user.email || "user@example.com");
      
      console.log("Generated new TOTP secret for setup");
      
      return new Response(JSON.stringify({ 
        secret: newSecret, 
        qrCodeURL,
        message: "Scan the QR code with Google Authenticator" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Verification code required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For initial setup, verify against the provided secret
      // For login verification, get the secret from the database
      let secretToVerify = secret;
      
      if (!secretToVerify) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("two_factor_secret")
          .eq("id", user.id)
          .single();
        
        secretToVerify = profile?.two_factor_secret;
      }

      if (!secretToVerify) {
        return new Response(JSON.stringify({ error: "No 2FA secret found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isValid = await verifyTOTP(secretToVerify, code);
      
      if (!isValid) {
        console.log("Invalid TOTP code");
        return new Response(JSON.stringify({ error: "Invalid verification code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("TOTP code verified successfully");
      return new Response(JSON.stringify({ success: true, message: "Code verified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "enable") {
      if (!secret || !code) {
        return new Response(JSON.stringify({ error: "Secret and verification code required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify the code first
      const isValid = await verifyTOTP(secret, code);
      
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid verification code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save the secret and enable 2FA
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          two_factor_enabled: true,
          two_factor_secret: secret 
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error enabling 2FA:", updateError);
        return new Response(JSON.stringify({ error: "Failed to enable 2FA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("2FA enabled successfully");
      return new Response(JSON.stringify({ success: true, message: "2FA enabled successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disable") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Verification code required to disable 2FA" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get existing secret
      const { data: profile } = await supabase
        .from("profiles")
        .select("two_factor_secret")
        .eq("id", user.id)
        .single();

      if (!profile?.two_factor_secret) {
        return new Response(JSON.stringify({ error: "2FA is not enabled" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify the code
      const isValid = await verifyTOTP(profile.two_factor_secret, code);
      
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid verification code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Disable 2FA
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          two_factor_enabled: false,
          two_factor_secret: null 
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error disabling 2FA:", updateError);
        return new Response(JSON.stringify({ error: "Failed to disable 2FA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("2FA disabled successfully");
      return new Response(JSON.stringify({ success: true, message: "2FA disabled successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in totp-2fa function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
