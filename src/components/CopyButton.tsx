import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from './Toast';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const toast = useToast();

  async function handle() {
    if (await copyText(text)) {
      setDone(true);
      toast.success('Tersalin ke clipboard');
      window.setTimeout(() => setDone(false), 1500);
    } else {
      toast.error('Gagal menyalin. Salin secara manual.');
    }
  }

  return (
    <button type="button" onClick={handle} className="btn btn-ghost p-2" aria-label={label} title={label}>
      {done ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </button>
  );
}
