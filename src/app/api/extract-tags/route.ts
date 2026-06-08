import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(request: Request) {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || 'dummy_key_for_build',
    });
    
    const { description } = await request.json();

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are a precise inventory data extractor. Analyze the input text and output a clean, valid JSON object exactly in this format: { "category": "String", "brand": "String or null", "color": "String or null", "distinguishing_marks": ["String"] }. Do not include markdown formatting or explanation. Only return the JSON.',
        },
        {
          role: 'user',
          content: description,
        },
      ],
      model: 'llama3-8b-8192',
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from Groq');
    }

    const parsedJson = JSON.parse(content);
    return NextResponse.json(parsedJson);

  } catch (error) {
    console.error('Error extracting tags:', error);
    return NextResponse.json(
      { error: 'Failed to extract tags' },
      { status: 500 }
    );
  }
}
