import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Blueprint matching formula: S = (w1 * C) + (w2 * B) + (w3 * Sim(D_F, D_L))
const WEIGHT_CATEGORY = 0.40;
const WEIGHT_BRAND = 0.35;
const WEIGHT_SIMILARITY = 0.25;
const MATCH_THRESHOLD = 0.78;

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Dependency-free stand-in for dense vector embeddings: cosine similarity
// over term-frequency vectors of the two item descriptions.
function cosineSimilarity(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const token of tokensA) freqA.set(token, (freqA.get(token) || 0) + 1);
  for (const token of tokensB) freqB.set(token, (freqB.get(token) || 0) + 1);

  const vocabulary = new Set([...freqA.keys(), ...freqB.keys()]);
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (const term of vocabulary) {
    const a = freqA.get(term) || 0;
    const b = freqB.get(term) || 0;
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function brandOf(aiTags: unknown): string {
  if (!aiTags || typeof aiTags !== 'object') return '';
  const brand = (aiTags as Record<string, unknown>).brand;
  return typeof brand === 'string' ? brand.trim().toLowerCase() : '';
}

export async function POST(request: Request) {
  try {
    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Matching engine not configured' }, { status: 500 });
    }

    // Service-role client: matching must read across users/institution and
    // write notifications for users other than the requester (RLS would block this).
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: foundItem, error: foundItemError } = await supabase
      .from('items')
      .select('id, institution_id, category, description, ai_tags, reporter_id')
      .eq('id', itemId)
      .single();

    if (foundItemError || !foundItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { data: lostItems, error: lostItemsError } = await supabase
      .from('items')
      .select('id, category, description, ai_tags, reporter_id')
      .eq('institution_id', foundItem.institution_id)
      .eq('status', 'lost');

    if (lostItemsError) throw lostItemsError;

    const candidateMatches = (lostItems || [])
      .filter((lost) => lost.reporter_id !== foundItem.reporter_id)
      .map((lost) => {
        const categoryScore = lost.category?.toLowerCase() === foundItem.category?.toLowerCase() ? 1 : 0;
        const lostBrand = brandOf(lost.ai_tags);
        const foundBrand = brandOf(foundItem.ai_tags);
        const brandScore = (!lostBrand || !foundBrand || lostBrand === foundBrand) ? 1 : 0;
        const similarityScore = cosineSimilarity(foundItem.description, lost.description);

        const score = (WEIGHT_CATEGORY * categoryScore)
          + (WEIGHT_BRAND * brandScore)
          + (WEIGHT_SIMILARITY * similarityScore);

        return { lost, score: Number(score.toFixed(3)) };
      })
      .filter(({ score }) => score >= MATCH_THRESHOLD);

    for (const { lost, score } of candidateMatches) {
      const { error: matchError } = await supabase.from('matches').insert({
        lost_item_id: lost.id,
        found_item_id: foundItem.id,
        score,
      });

      // Unique (lost_item_id, found_item_id) constraint guards re-triggers —
      // a duplicate-key error just means this pair was already notified.
      if (matchError) {
        if (matchError.code !== '23505') console.error('Failed to persist match:', matchError);
        continue;
      }

      if (lost.reporter_id) {
        await supabase.from('notifications').insert({
          user_id: lost.reporter_id,
          type: 'ai_match',
          title: 'Potential match found for your lost item',
          body: `Our AI matching engine found a ${Math.round(score * 100)}% likely match in the found-items ledger.`,
          link: `/item/${foundItem.id}`,
        });
      }
    }

    return NextResponse.json({ matched: candidateMatches.length });
  } catch (err) {
    console.error('Matching engine error:', err);
    return NextResponse.json({ error: 'Matching failed' }, { status: 500 });
  }
}
