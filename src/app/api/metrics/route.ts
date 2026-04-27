import { NextResponse } from 'next/server';

// We fetch LLMs and Image models from Artificial Analysis API
export async function GET(req: Request) {
  try {
    const ARTIFICIAL_ANALYSIS_API_KEY = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
    if (!ARTIFICIAL_ANALYSIS_API_KEY) {
      return NextResponse.json({ error: 'Missing Artificial Analysis API Key' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'llms'; // llms or image

    let endpoint = 'https://artificialanalysis.ai/api/v2/data/llms/models';
    if (type === 'image') {
      endpoint = 'https://artificialanalysis.ai/api/v2/data/media/text-to-image';
    }

    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': ARTIFICIAL_ANALYSIS_API_KEY
      },
      // Cache for 1 hour to avoid hitting the 1000/day rate limit easily
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Artificial Analysis API Error:', text);
      return NextResponse.json({ error: 'Failed to fetch from Artificial Analysis' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Metrics API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
