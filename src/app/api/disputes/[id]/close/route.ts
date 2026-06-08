import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Only the finder (item reporter) can close a dispute — this is the explicit
// "transaction is finalized" action.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: disputeId } = await params;

    const session = await createServerClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: dispute } = await service
      .from('claim_disputes')
      .select('id, item_id, finder_id, receiver_id, reporter_id, status')
      .eq('id', disputeId)
      .single();

    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    if (dispute.finder_id !== user.id) {
      return NextResponse.json({ error: 'Only the finder can close this dispute' }, { status: 403 });
    }
    if (dispute.status === 'closed') {
      return NextResponse.json({ error: 'This dispute is already closed' }, { status: 409 });
    }

    const { error: updateError } = await service
      .from('claim_disputes')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', disputeId);
    if (updateError) throw updateError;

    const recipients = [dispute.reporter_id, dispute.receiver_id].filter(Boolean) as string[];
    if (recipients.length) {
      await service.from('notifications').insert(recipients.map((uid) => ({
        user_id: uid,
        type: 'dispute_closed',
        title: 'Dispute resolved',
        body: 'The finder marked this dispute as resolved and finalized the return.',
        link: `/item/${dispute.item_id}`,
      })));
    }

    return NextResponse.json({ closed: true });
  } catch (err) {
    console.error('disputes/close error:', err);
    return NextResponse.json({ error: 'Failed to close dispute' }, { status: 500 });
  }
}
