export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response('Hello from auth API');
}

export async function POST(request: Request) {
  // ... 既存のコード
}
