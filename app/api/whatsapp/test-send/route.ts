import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppBot } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { to, text } = await req.json();

    if (!to || !text) {
      return NextResponse.json(
        { error: 'Missing destination ("to") or message text ("text")' },
        { status: 400 }
      );
    }

    const bot = getWhatsAppBot();
    if (bot.status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp bot is not connected. Connect via QR code first.' },
        { status: 400 }
      );
    }

    const result = await bot.sendMessage(to, text);
    return NextResponse.json({
      success: true,
      message: `Message sent successfully to ${to}`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
