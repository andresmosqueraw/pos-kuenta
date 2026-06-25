import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const message = await request.text();
  const privateKeyPem = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!privateKeyPem) {
    return NextResponse.json({ error: 'QZ_PRIVATE_KEY no configurada' }, { status: 500 });
  }

  const sign = crypto.createSign('SHA512');
  sign.update(message);
  const signature = sign.sign(privateKeyPem, 'base64');

  return new Response(signature, { headers: { 'Content-Type': 'text/plain' } });
}
