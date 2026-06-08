import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
            'You are a precise lost-and-found inventory data extractor. Analyze the input text describing an item and output a clean, valid JSON object exactly in this format: { "category": "one of: Electronics, Identification, Personal Items, Documents, Keys", "brand": "String or null", "color": "String or null", "distinguishing_marks": ["String"] }. Pick the single closest category. Use null when a field is not mentioned. Do not include markdown formatting or explanation. Only return the JSON.',
        },
        {
          role: 'user',
          content: description,
        },
      ],
      model: 'llama-3.3-70b-versatile',
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
