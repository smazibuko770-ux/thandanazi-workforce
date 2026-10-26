import { Camera } from 'lucide-react';
export function PhotoInput({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return <label className="block rounded-3xl border border-dashed border-orange-500/35 bg-orange-500/5 p-4 cursor-pointer active:scale-[0.99] transition">
    <span className="flex items-center gap-3"><span className="h-11 w-11 rounded-2xl bg-orange-500/15 grid place-items-center text-orange-500"><Camera size={22}/></span><span><span className="block font-bold text-zinc-100">{label}</span><span className="block text-xs text-zinc-500 mt-1">Tap to open camera or upload JPEG/PNG, max 5MB</span></span></span>
    <input className="hidden" type="file" accept="image/jpeg,image/png" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (!['image/jpeg','image/png'].includes(file.type)) return alert('Only JPEG/PNG photos are allowed.'); if (file.size > 5*1024*1024) return alert('Photo must be 5MB or smaller.'); onFile(file); }} />
  </label>;
}
