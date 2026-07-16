import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppBot } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const bot = getWhatsAppBot();
  const botApiKey = bot.apiKey;

  try {
    // 1. Authenticate API Key from multiple potential locations
    let clientApiKey = '';

    // A. Check Authorization Bearer header
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      clientApiKey = authHeader.substring(7).trim();
    }

    // B. Check Custom X-API-Key header
    if (!clientApiKey) {
      const xApiKey = req.headers.get('x-api-key');
      if (xApiKey) {
        clientApiKey = xApiKey.trim();
      }
    }

    // C. Check URL Query Parameters
    const url = new URL(req.url);
    if (!clientApiKey) {
      const queryKey = url.searchParams.get('key') || url.searchParams.get('apiKey');
      if (queryKey) {
        clientApiKey = queryKey.trim();
      }
    }

    // Parse the JSON body
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Body might be empty or invalid, will handle below
    }

    // D. Check Request Body
    if (!clientApiKey) {
      clientApiKey = (body.apiKey || body.key || '').trim();
    }

    // Validate the API Key
    if (!clientApiKey || clientApiKey !== botApiKey) {
      bot.addLog('warning', 'Unauthorized Webhook access attempt detected', `Client provided key: ${clientApiKey || 'None'}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Invalid or missing API key.',
          instructions: 'Include your API key as a Bearer token in the Authorization header, or using X-API-Key header, or key query parameter.',
        },
        { status: 401 }
      );
    }

    // 2. Validate payload properties (flexible mapping for multiple shapes)
    const to = (body.to || body.number || body.phone || body.recipient || '').toString().trim();
    const text = (body.message || body.text || body.body || '').toString().trim();

    if (!to || !text) {
      bot.addLog('warning', 'Webhook request failed validation', `Missing parameters. Payload: ${JSON.stringify(body)}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters. You must specify a recipient ("to" or "phone") and a message ("text" or "message").',
          receivedPayload: body,
        },
        { status: 400 }
      );
    }

    // 3. Ensure WhatsApp Bot is connected
    if (bot.status !== 'connected') {
      bot.addLog('error', 'Webhook failed: Bot is not connected.', `Attempted destination: ${to}`);
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp Bot is currently disconnected. Please log in via the app dashboard first.',
        },
        { status: 503 }
      );
    }

    // 4. Send Message via WhatsApp
    bot.addLog('info', `Webhook received message request for ${to}`);
    const result = await bot.sendMessage(to, text);

    return NextResponse.json({
      success: true,
      message: `Message sent successfully to ${to}`,
      recipient: to,
      text_length: text.length,
      result_id: result?.key?.id || null,
    });

  } catch (error) {
    bot.addLog('error', 'Webhook execution crashed', (error as Error).message);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// Support simple health check or GET to help users format webhooks
export async function GET() {
  const bot = getWhatsAppBot();
  return NextResponse.json({
    status: 'active',
    name: 'WhatsApp Webhook API gateway',
    endpoint: '/api/webhook',
    allowedMethods: ['POST'],
    expectedPayload: {
      to: 'Phone number (with country code, e.g. 15550199)',
      message: 'Text message contents',
    },
    authMethods: [
      'Authorization: Bearer <API_KEY>',
      'X-API-Key: <API_KEY>',
      '?key=<API_KEY>',
      '{"apiKey": "<API_KEY>" in JSON request body}',
    ],
  });
}
