import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const WINDOW_MS = 24 * 60 * 60 * 1000;

// A third party reports that the wrong person received a returned item.
// All participant identities are derived server-side (never trusted from the
// client), and a user may open at most one dispute per item (DB UNIQUE).
export async function POST(request: Request) {
  try {
    const session = await createServerClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId, reason } = await request.json();
    if (!itemId || typeof itemId !== 'string' || !reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json({ error: 'Please describe the problem in a little more detail (at least 10 characters).' }, { status: 400 });
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
      .select('id, title, status, returned_at, reporter_id, institution_id')
      .eq('id', itemId)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    if (item.status !== 'claimed' || !item.returned_at) {
      return NextResponse.json({ error: 'This item has not been marked returned, so there is nothing to dispute.' }, { status: 400 });
    }
    if (Date.now() - new Date(item.returned_at).getTime() > WINDOW_MS) {
      return NextResponse.json({ error: 'The 24-hour window to report this return has closed.' }, { status: 400 });
    }

    // Reporter must belong to the same campus.
    const { data: me } = await service.from('users').select('institution_id').eq('id', user.id).single();
    if (!me || me.institution_id !== item.institution_id) {
      return NextResponse.json({ error: 'You can only report items from your own campus.' }, { status: 403 });
    }

    // The receiver = the approved claimant who took the item.
    const { data: approvedClaim } = await service
      .from('claims')
      .select('id, claimant_id')
      .eq('item_id', itemId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (user.id === item.reporter_id) {
      return NextResponse.json({ error: 'You are the finder of this item — start a chat from the claim instead.' }, { status: 400 });
    }
    if (approvedClaim && user.id === approvedClaim.claimant_id) {
      return NextResponse.json({ error: 'You are the person who received this item.' }, { status: 400 });
    }

    const { data: dispute, error: insertError } = await service
      .from('claim_disputes')
      .insert({
        item_id: itemId,
        claim_id: approvedClaim?.id ?? null,
        finder_id: item.reporter_id,
        receiver_id: approvedClaim?.claimant_id ?? null,
        reporter_id: user.id,
        reason: reason.trim(),
        status: 'open',
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'You have already reported this return.' }, { status: 409 });
      }
      console.error('dispute insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to file report' }, { status: 500 });
    }

    // Notify the finder and the receiver (best-effort, service role bypasses RLS).
    const { data: reporter } = await service.from('users').select('name').eq('id', user.id).single();
    const recipients = [item.reporter_id, approvedClaim?.claimant_id].filter(Boolean) as string[];
    if (recipients.length) {
      await service.from('notifications').insert(recipients.map((uid) => ({
        user_id: uid,
        type: 'dispute_opened',
        title: `Return disputed: "${item.title}"`,
        body: `${reporter?.name || 'A student'} reported a problem with this return. Open the chat to resolve it.`,
        link: `/item/${itemId}`,
      })));
    }

    return NextResponse.json({ disputeId: dispute.id });
  } catch (err) {
    console.error('disputes/create error:', err);
    return NextResponse.json({ error: 'Failed to file report' }, { status: 500 });
  }
}
