import { Search } from 'lucide-react';

// Global buffer screen — shown automatically during route/data transitions.
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-surface gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg animate-[subtle-float_2s_ease-in-out_infinite]">
          <Search size={36} className="text-on-primary" />
        </div>
        <span className="absolute -inset-2 rounded-3xl border-2 border-primary/30 animate-ping" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-primary tracking-tight">CampusFind</h1>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </div>
  );
}
