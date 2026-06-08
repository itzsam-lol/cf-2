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

    const { data: adminUser } = await supabase
      .from('users')
      .select('role, institution_id')
      .eq('id', user.id)
      .single();

    if (!adminUser || (adminUser.role !== 'campus_admin' && adminUser.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const { data: claim, error: claimFetchError } = await supabase
      .from('claims')
      .select('id, item_id, status, items!inner(id, institution_id)')
      .eq('id', claimId)
      .single();

    if (claimFetchError || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const item = Array.isArray(claim.items) ? claim.items[0] : claim.items;
    if (!item || item.institution_id !== adminUser.institution_id) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }
    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Claim has already been processed' }, { status: 409 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Release flow not configured' }, { status: 500 });
    }

    // Service-role client: persisting the signed token and flipping item/claim
    // status must succeed atomically and bypass the per-row RLS checks.
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: claimUpdateError } = await serviceClient
      .from('claims')
      .update({ status: 'approved', processed_by: user.id })
      .eq('id', claimId);
    if (claimUpdateError) throw claimUpdateError;

    const { error: itemUpdateError } = await serviceClient
      .from('items')
      .update({ status: 'claimed' })
      .eq('id', item.id);
    if (itemUpdateError) throw itemUpdateError;

    const { token, expiresAt } = generatePickupToken(claimId, item.id);

    const { error: tokenInsertError } = await serviceClient.from('pickup_tokens').insert({
      claim_id: claimId,
      item_id: item.id,
      token,
      expires_at: expiresAt,
    });
    if (tokenInsertError) throw tokenInsertError;

    return NextResponse.json({ token, expiresAt });
  } catch (err) {
    console.error('Claim approval error:', err);
    return NextResponse.json({ error: 'Failed to approve claim' }, { status: 500 });
  }
}
