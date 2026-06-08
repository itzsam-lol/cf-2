'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: { name: string } | null;
}

// Claim-scoped chat between the claimant and the item's finder.
// Reads/writes the `messages` table directly; RLS restricts access to the two
// participants (and read-only for admins). Polls for new messages.
export default function ChatPanel({
  claimId,
  currentUserId,
  otherPartyName,
  readOnly = false,
}: {
  claimId: string;
  currentUserId: string;
  otherPartyName?: string;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at, sender:users!sender_id(name)')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: true });
    setMessages((data as unknown as Message[]) || []);
    setLoading(false);
  }, [claimId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    // Optimistic append
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    const supabase = createClient();
    const { error } = await supabase.from('messages').insert({ claim_id: claimId, sender_id: currentUserId, body });
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
    } else {
      load();
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-container-low flex items-center gap-2">
        <MessageCircle size={18} className="text-primary" />
        <span className="text-sm font-semibold text-on-surface">
          {otherPartyName ? `Chat with ${otherPartyName}` : 'Chat'}
        </span>
        {readOnly && <span className="ml-auto text-xs text-on-surface-variant">read-only (oversight)</span>}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[360px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-on-surface-variant">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant gap-1 py-8">
            <MessageCircle size={28} className="opacity-40" />
            <p className="text-sm">No messages yet.</p>
            {!readOnly && <p className="text-xs">Say hello and arrange a safe handover spot on campus.</p>}
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm ${
                    mine
                      ? 'bg-primary text-on-primary rounded-br-sm'
                      : 'bg-surface-container-high text-on-surface rounded-bl-sm'
                  }`}
                >
                  {!mine && m.sender?.name && (
                    <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender.name}</p>
                  )}
                  <p className="leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${mine ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!readOnly && (
        <form onSubmit={send} className="p-3 border-t border-border bg-surface flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 bg-surface-container-low border border-outline-variant rounded-full px-4 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="w-10 h-10 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-50 hover:bg-primary-container transition-colors"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      )}
    </div>
  );
}
