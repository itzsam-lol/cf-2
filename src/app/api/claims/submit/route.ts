import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Scores how well a claimant's answer matches the finder's private secret.
// Runs entirely server-side so `secret_hint` is never exposed to the client.
async function scoreClaim(opts: {
  title: string;
  description: string;
  secret: string | null;
  proof: string;
}): Promise<{ score: number; analysis: string }> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key_for_build' });

  const hasSecret = Boolean(opts.secret && opts.secret.trim());
  const system = hasSecret
    ? `You are a fraud-prevention verifier for a campus lost & found. The finder of an item recorded a PRIVATE secret detail that only the true owner could know. Compare the claimant's statement against that secret and the item description. Output ONLY valid JSON: { "score": <integer 0-100>, "analysis": "<one or two sentences explaining the score, never revealing the secret>" }. Score 0 if it contradicts the secret, ~50 if vague/partial, 90-100 if it clearly and specifically matches the secret.`
    : `You are a fraud-prevention verifier for a campus lost & found. No private secret was recorded for this item, so judge only how specific and plausible the claimant's ownership evidence is versus the public item description. Output ONLY valid JSON: { "score": <integer 0-100>, "analysis": "<one or two sentences>" }. Reward specific, verifiable, non-public details; penalize vague or generic claims.`;

  const user = [
    `ITEM: ${opts.title}`,
    `PUBLIC DESCRIPTION: ${opts.description || '(none)'}`,
    hasSecret ? `PRIVATE SECRET (finder-only): ${opts.secret}` : null,
    `CLAIMANT'S STATEMENT: ${opts.proof}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('empty AI response');
    const parsed = JSON.parse(content);
    let score = Number(parsed.score);
    if (!Number.isFinite(score)) score = 0;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const analysis = typeof parsed.analysis === 'string' ? parsed.analysis : 'No analysis available.';
    return { score, analysis };
  } catch (err) {
    console.error('Claim scoring failed:', err);
    // Don't block a legitimate claim if the AI is unavailable — leave it unscored.
    return { score: 0, analysis: 'AI verification was unavailable; the finder will review manually.' };
  }
}

export async function POST(request: Request) {
  try {
    const session = await createServerClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId, proof } = await request.json();
    if (!itemId || typeof itemId !== 'string' || !proof || typeof proof !== 'string' || !proof.trim()) {
      return NextResponse.json({ error: 'Item and written evidence are required' }, { status: 400 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: item } = await service
      .from('items')
      .select('id, title, description, secret_hint, reporter_id, status, institution_id')
      .eq('id', itemId)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    if (item.reporter_id === user.id) {
      return NextResponse.json({ error: 'You cannot claim an item you reported' }, { status: 400 });
    }
    if (item.status === 'claimed') {
      return NextResponse.json({ error: 'This item has already been returned' }, { status: 400 });
    }

    // One active claim per user per item.
    const { data: existing } = await service
      .from('claims')
      .select('id')
      .eq('item_id', itemId)
      .eq('claimant_id', user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'You already filed a claim for this item', claimId: existing.id }, { status: 409 });
    }

    const { score, analysis } = await scoreClaim({
      title: item.title,
      description: item.description,
      secret: item.secret_hint,
      proof: proof.trim(),
    });

    const { data: claim, error: insertError } = await service
      .from('claims')
      .insert({
        item_id: itemId,
        claimant_id: user.id,
        verification_proof: proof.trim(),
        status: 'pending',
        ai_match_score: score,
        ai_analysis: analysis,
      })
      .select('id')
      .single();

    if (insertError || !claim) {
      console.error('Claim insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 });
    }

    // Notify the finder that a claim was filed, with the AI confidence.
    if (item.reporter_id) {
      const { data: claimant } = await service.from('users').select('name').eq('id', user.id).single();
      await service.from('notifications').insert({
        user_id: item.reporter_id,
        type: 'new_claim',
        title: `New claim on "${item.title}"`,
        body: `${claimant?.name || 'A student'} filed a claim · AI match confidence ${score}%.`,
        link: `/item/${itemId}`,
      });
    }

    return NextResponse.json({ claimId: claim.id, score });
  } catch (err) {
    console.error('claims/submit error:', err);
    return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 });
  }
}
