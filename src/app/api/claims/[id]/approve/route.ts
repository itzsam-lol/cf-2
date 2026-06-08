import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { generatePickupToken } from '@/lib/pickupToken';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: claimId } = await params;

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: claim, error: claimFetchError } = await supabase
      .from('claims')
      .select('id, item_id, claimant_id, status, items!inner(id, reporter_id, title)')
      .eq('id', claimId)
      .single();

    if (claimFetchError || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const item = Array.isArray(claim.items) ? claim.items[0] : claim.items;
    // Only the finder (the student who reported the item) may approve a claim
    // on it and authorize the handover.
    if (!item || item.reporter_id !== user.id) {
      return NextResponse.json({ error: 'Only the finder can approve this claim' }, { status: 403 });
    }
    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Claim has already been processed' }, { status: 409 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Release flow not configured' }, { status: 500 });
    }

    // Service-role client: persisting the signed token and flipping claim
    // status must succeed atomically and bypass the per-row RLS checks.
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Approve the claim and mint the receiver's signed pickup token. The item
    // is NOT marked returned yet — that happens when the finder physically
    // hands it over and scans the receiver's QR at /api/claims/release.
    const { error: claimUpdateError } = await serviceClient
      .from('claims')
      .update({ status: 'approved', processed_by: user.id })
      .eq('id', claimId);
    if (claimUpdateError) throw claimUpdateError;

    const { token, expiresAt } = generatePickupToken(claimId, item.id);

    const { error: tokenInsertError } = await serviceClient.from('pickup_tokens').insert({
      claim_id: claimId,
      item_id: item.id,
      token,
      expires_at: expiresAt,
    });
    if (tokenInsertError) throw tokenInsertError;

    // Notify the receiver that their claim was approved and a pickup QR is ready.
    const itemTitle = Array.isArray(claim.items) ? claim.items[0]?.title : (claim.items as { title?: string })?.title;
    await serviceClient.from('notifications').insert({
      user_id: claim.claimant_id,
      type: 'claim_approved',
      title: 'Your claim was approved',
      body: `Show your pickup QR for "${itemTitle ?? 'your item'}" to the finder to complete the handover.`,
      link: `/item/${claim.item_id}`,
    });

    return NextResponse.json({ token, expiresAt });
  } catch (err) {
    console.error('Claim approval error:', err);
    return NextResponse.json({ error: 'Failed to approve claim' }, { status: 500 });
  }
}
