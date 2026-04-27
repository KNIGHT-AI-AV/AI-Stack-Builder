import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Read ecosystem data once at startup
const ecosystemPath = path.join(process.cwd(), 'src', 'data', 'ecosystem.json');
const ecosystemData = JSON.parse(fs.readFileSync(ecosystemPath, 'utf8'));

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Missing OpenRouter API Key in environment variables' }, { status: 500 });
    }

    const systemPrompt = `
You are an expert AI software architect. The user wants to build a software application or system.
You must map their idea into a connected node graph of the exact AI models, databases, and infrastructure tools required to build it.
Use the following 2026 AI Ecosystem data as your primary source of tools:
${JSON.stringify(ecosystemData, null, 2)}

You must return your response ONLY as a valid JSON object matching this structure:
{
  "nodes": [
    { "id": "node_id_1", "type": "tool", "data": { "label": "Name of Tool", "category": "Category Name", "description": "Short desc" } }
  ],
  "edges": [
    { "id": "edge_1", "source": "node_id_1", "target": "node_id_2", "label": "connects to / uses" }
  ]
}

Instructions for the graph:
1. Include 4 to 8 nodes total.
2. Group logical combinations (e.g., Frontend Host -> AI Agent -> Model -> Vector DB).
3. The "type" of the node should be "tool".
4. Output nothing except the raw JSON. No markdown formatting (\`\`\`json) or explanations.
`;

    // Minimax M2.7 on OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://knightaiav.com', // Optional but recommended
        'X-Title': 'AI Stack Builder',
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.7', // Or fallback to a generic if not available, but user specified Minimax M2.7
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API Error:', errorText);
      return NextResponse.json({ error: 'Failed to fetch from OpenRouter' }, { status: response.status });
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content.trim();
    
    // Attempt to parse the JSON. In case the model wrapped it in markdown.
    let jsonResult;
    try {
      // Strip markdown block if present
      const cleanText = resultText.replace(/^```(json)?|```$/gi, '').trim();
      jsonResult = JSON.parse(cleanText);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', resultText);
      return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 });
    }

    return NextResponse.json(jsonResult);
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
