import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantId, orderId, amount, currency } = body;

    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    if (!secret) {
      console.error('PAYHERE_MERCHANT_SECRET not set');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (!merchantId || !orderId || !amount || !currency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const hashInput = `${merchantId}${orderId}${amount}${currency}${hashedSecret}`;
    const hash = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    return NextResponse.json({ hash });
  } catch (error) {
    console.error('Hash route error:', error);
    return NextResponse.json({ error: 'Hash generation failed' }, { status: 500 });
  }
}