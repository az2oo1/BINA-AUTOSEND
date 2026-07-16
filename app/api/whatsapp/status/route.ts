import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppBot } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const bot = getWhatsAppBot();
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const webhookUrl = `${protocol}://${host}/api/webhook`;
    
    return NextResponse.json({
      status: bot.status,
      qrCodeDataUrl: bot.qrCodeDataUrl,
      user: bot.user,
      error: bot.error,
      apiKey: bot.apiKey,
      logs: bot.logs,
      webhookUrl,
      outgoingWebhookUrl: bot.outgoingWebhookUrl,
      outgoingWebhookEnabled: bot.outgoingWebhookEnabled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const bot = getWhatsAppBot();

    if (action === 'update_config') {
      bot.outgoingWebhookUrl = body.outgoingWebhookUrl || '';
      bot.outgoingWebhookEnabled = body.outgoingWebhookEnabled !== undefined ? !!body.outgoingWebhookEnabled : false;
      bot.saveConfig();
      return NextResponse.json({ message: 'Configuration updated successfully.' });
    }

    if (action === 'regenerate_key') {
      const newKey = bot.regenerateApiKey();
      return NextResponse.json({ apiKey: newKey, message: 'API key regenerated successfully.' });
    }

    if (action === 'logout') {
      await bot.logout();
      return NextResponse.json({ message: 'Logged out successfully.' });
    }

    if (action === 'reconnect') {
      await bot.init();
      return NextResponse.json({ message: 'Reconnection flow triggered.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
