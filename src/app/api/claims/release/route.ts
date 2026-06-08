import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyPickupToken } from '@/lib/pickupToken';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Scanned code is missing or unreadable' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('users')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .single();

    if (!adminUser || (adminUser.role !== 'campus_admin' && adminUser.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const payload = verifyPickupToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or tampered pickup code' }, { status: 400 });
    }
    if (Date.now() > payload.expiresAt) {
      return NextResponse.json({ error: 'This pickup code has expired' }, { status: 410 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Release flow not configured' }, { status: 500 });
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: tokenRow, error: tokenFetchError } = await serviceClient
      .from('pickup_tokens')
      .select('id, claim_id, item_id, used_at, items!inner(id, institution_id, status, title)')
      .eq('token', token)
      .single();

    if (tokenFetchError || !tokenRow) {
      return NextResponse.json({ error: 'Pickup code not recognized' }, { status: 404 });
    }

    const item = Array.isArray(tokenRow.items) ? tokenRow.items[0] : tokenRow.items;
    if (!item || item.institution_id !== adminUser.institution_id) {
      return NextResponse.json({ error: 'Pickup code not recognized' }, { status: 404 });
    }
    if (tokenRow.used_at) {
      return NextResponse.json({ error: 'This pickup code has already been used' }, { status: 409 });
    }

    const { error: tokenUpdateError } = await serviceClient
      .from('pickup_tokens')
      .update({ used_at: new Date().toISOString(), scanned_by: adminUser.id })
      .eq('id', tokenRow.id);
    if (tokenUpdateError) throw tokenUpdateError;

    const { error: itemUpdateError } = await serviceClient
      .from('items')
      .update({ status: 'claimed' })
      .eq('id', item.id);
    if (itemUpdateError) throw itemUpdateError;

    return NextResponse.json({ released: true, itemTitle: item.title });
  } catch (err) {
    console.error('Pickup release error:', err);
    return NextResponse.json({ error: 'Failed to release item' }, { status: 500 });
  }
}
