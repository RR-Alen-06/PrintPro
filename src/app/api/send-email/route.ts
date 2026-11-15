import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/services/rateLimit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_RATE_LIMIT_MAX = 20;
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the caller session server-side
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const isSupabaseConfigured =
      Boolean(supabaseUrl && supabaseKey) &&
      !supabaseUrl!.includes('placeholder') &&
      supabaseUrl !== 'https://your-supabase-project.supabase.co';

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication service is not configured.' },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Readonly in some contexts
          }
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to send invoice emails.' },
        { status: 401 }
      );
    }

    // 2. Parse payload with explicit allowlist (drops role, permissions, price, credits, status, IDs, etc.)
    const body = await request.json();
    const to_email = typeof body.to_email === 'string' ? body.to_email.trim() : '';
    const bill_number = typeof body.bill_number === 'string' ? body.bill_number.trim() : '';
    const customer_name = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
    const grand_total = typeof body.grand_total === 'string' || typeof body.grand_total === 'number' ? String(body.grand_total) : '';
    const shop_name = typeof body.shop_name === 'string' ? body.shop_name.trim() : '';
    const message_html = typeof body.message_html === 'string' ? body.message_html : '';
    const message_text = typeof body.message_text === 'string' ? body.message_text : '';
    const pdf_attachment = typeof body.pdf_attachment === 'string' ? body.pdf_attachment : '';
    const customServiceId = typeof body.customServiceId === 'string' ? body.customServiceId.trim() : undefined;
    const customTemplateId = typeof body.customTemplateId === 'string' ? body.customTemplateId.trim() : undefined;
    const customPublicKey = typeof body.customPublicKey === 'string' ? body.customPublicKey.trim() : undefined;

    if (!to_email || to_email.length > 254 || !EMAIL_REGEX.test(to_email)) {
      return NextResponse.json({ error: 'A valid recipient email is required.' }, { status: 400 });
    }

    if (
      bill_number.length > 200 ||
      customer_name.length > 200 ||
      shop_name.length > 200 ||
      grand_total.length > 64 ||
      message_html.length > 100_000 ||
      message_text.length > 50_000 ||
      pdf_attachment.length > 5_000_000
    ) {
      return NextResponse.json({ error: 'Request payload exceeds allowed size limits.' }, { status: 400 });
    }

    const rateCheck = await checkRateLimit(
      supabase,
      `send-email:${user.id}`,
      EMAIL_RATE_LIMIT_MAX,
      EMAIL_RATE_LIMIT_WINDOW_SECONDS,
      true
    );
    if (rateCheck.blocked) {
      return NextResponse.json(
        { error: 'Too many email requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      );
    }

    // 3. Resolve service credentials (server-side environment variables take precedence;
    // custom IDs are only permitted as fallback when server env vars are unset and must match safe ID format)
    const safeIdPattern = /^[a-zA-Z0-9_-]{3,64}$/;
    const serviceId = process.env.EMAILJS_SERVICE_ID || (customServiceId && safeIdPattern.test(customServiceId) ? customServiceId : undefined);
    const templateId = process.env.EMAILJS_TEMPLATE_ID || (customTemplateId && safeIdPattern.test(customTemplateId) ? customTemplateId : undefined);
    const publicKey = process.env.EMAILJS_PUBLIC_KEY || (customPublicKey && safeIdPattern.test(customPublicKey) ? customPublicKey : undefined);
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey) {
      return NextResponse.json(
        { error: 'EmailJS credentials not configured on the server or in shop settings.' },
        { status: 400 }
      );
    }

    // 4. Dispatch email via EmailJS HTTP API server-to-server
    const payload: Record<string, unknown> = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email,
        bill_number: bill_number || 'N/A',
        customer_name: customer_name || 'Valued Customer',
        grand_total: grand_total || '0.00',
        shop_name: shop_name || 'Store',
        message_html: message_html || '',
        message_text: message_text || '',
        pdf_attachment: pdf_attachment || '',
      },
    };

    if (privateKey) {
      payload.accessToken = privateKey;
    }

    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error('EmailJS delivery error:', emailResponse.status, errText);
      return NextResponse.json(
        { error: 'Failed to deliver email through EmailJS service.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice email sent successfully.',
    });
  } catch (err: unknown) {
    console.error('send-email error:', err);
    return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 });
  }
}
