export async function GET() {
  const publicKey = process.env.QZ_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? '';
  return new Response(publicKey, { headers: { 'Content-Type': 'text/plain' } });
}
