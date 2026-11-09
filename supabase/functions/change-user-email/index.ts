// @ts-nocheck
// Supabase Edge Function (Deno Runtime)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Standard RFC 5322 compliant regex for basic email format validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Only POST requests are supported.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing service credentials.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Extract Authorization Header and verify caller identity
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    // User-scoped client to authenticate the caller
    const supabaseUser = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user: callerUser }, error: callerError } = await supabaseUser.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired access token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse and validate request body
    let body: { userId?: string; newEmail?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload in request body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, newEmail } = body;

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "userId" field.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newEmail || typeof newEmail !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "newEmail" field.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Authorization check: Caller must be the target user OR have admin privileges
    const isSelf = callerUser.id === userId;
    const isAdmin =
      callerUser.app_metadata?.role === 'admin' ||
      callerUser.user_metadata?.role === 'admin' ||
      callerUser.app_metadata?.is_admin === true;

    if (!isSelf && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have permission to modify this user email.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Admin client with Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Verify target user exists
    const { data: targetUserData, error: getTargetUserErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getTargetUserErr || !targetUserData?.user) {
      return new Response(
        JSON.stringify({ error: 'Target user not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUserData.user.email?.toLowerCase() === cleanEmail) {
      return new Response(
        JSON.stringify({ error: 'New email is identical to the current email.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Update user email via Admin API (WITHOUT sending any confirmation emails)
    const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email: cleanEmail,
        email_confirm: true
      }
    );

    if (updateErr) {
      // Handle duplicate / already registered email error cleanly
      if (
        updateErr.message?.toLowerCase().includes('already registered') ||
        updateErr.message?.toLowerCase().includes('already in use') ||
        updateErr.status === 422
      ) {
        return new Response(
          JSON.stringify({ error: 'This email is already registered to another account.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('Supabase admin updateUserById error:', updateErr);
      return new Response(
        JSON.stringify({ error: `Failed to update email: ${updateErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Update any mirror copies of email in application tables (e.g. settings / profiles / customers)
    let appTablesUpdated = true;
    try {
      // Update customer record if user is registered as a customer
      await supabaseAdmin
        .from('customers')
        .update({ email: cleanEmail })
        .eq('user_id', userId);

      // Log the email update in the immutable audit log
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: userId,
        user_name: callerUser.email || 'Admin',
        action: 'CHANGE_USER_EMAIL',
        entity: `User ${userId}`,
        previous_value: targetUserData.user.email || 'None',
        new_value: cleanEmail
      }]);
    } catch (tableErr) {
      console.warn('Warning: Non-critical error updating app tables / audit log:', tableErr);
      appTablesUpdated = false;
    }

    // 8. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email address updated and confirmed successfully without sending emails.',
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          email_confirmed_at: updatedUser.user.email_confirmed_at
        },
        appTablesUpdated
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
    console.error('Unhandled Edge Function error:', err);
    return new Response(
      JSON.stringify({ error: `Internal server error: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
