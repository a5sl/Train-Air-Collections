import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type Kind = 'ok' | 'warn' | 'err';

interface ToastItem { id: number; msg: string; kind: Kind; leaving: boolean; }
interface ConfirmOpts { title: string; message: string; confirmText?: string; danger?: boolean; }

interface ToastCtx {
  toast: (msg: string, kind?: Kind) => void;
  confirmDlg: (opts: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used within ToastProvider');
  return v;
}

const ICONS: Record<Kind, React.ReactNode> = {
  ok: <CheckCircle2 className="w-4 h-4 text-brand" />,
  warn: <AlertTriangle className="w-4 h-4 text-accent" />,
  err: <XCircle className="w-4 h-4 text-red-500" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [dlg, setDlg] = useState<ConfirmOpts | null>(null);
  const dlgResolve = useRef<((v: boolean) => void) | null>(null);
  const idRef = useRef(1);

  const toast = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = idRef.current++;
    setItems((prev) => [...prev.slice(-3), { id, msg, kind, leaving: false }]);
    setTimeout(() => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, leaving: true } : it)));
      setTimeout(() => setItems((prev) => prev.filter((it) => it.id !== id)), 240);
    }, 3200);
  }, []);

  const confirmDlg = useCallback((opts: ConfirmOpts) => {
    setDlg(opts);
    return new Promise<boolean>((resolve) => { dlgResolve.current = resolve; });
  }, []);

  const closeDlg = (v: boolean) => {
    setDlg(null);
    dlgResolve.current?.(v);
    dlgResolve.current = null;
  };

  return (
    <Ctx.Provider value={{ toast, confirmDlg }}>
      {children}

      {/* 告示（Toast） */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none">
        {items.map((it) => (
          <div
            key={it.id}
            className={'toast-item card px-4 py-2.5 flex items-center gap-2.5 pointer-events-auto ' + (it.leaving ? 'toast-out' : '')}
            style={{ boxShadow: 'var(--shadow-pop)' }}
          >
            {ICONS[it.kind]}
            <span className="text-sm text-content">{it.msg}</span>
          </div>
        ))}
      </div>

      {/* 确认浮层 */}
      {dlg && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/30 overlay-in" onClick={() => closeDlg(false)}>
          <div className="card w-[320px] max-w-[90vw] p-5 dialog-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-content mb-2">{dlg.title}</h3>
            <p className="text-sm text-content-secondary mb-5">{dlg.message}</p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary text-xs px-3 py-2" onClick={() => closeDlg(false)}>作罢</button>
              <button
                className={(dlg.danger ? 'btn-danger' : 'btn-primary') + ' text-xs px-3 py-2'}
                onClick={() => closeDlg(true)}
              >
                {dlg.confirmText || '照办'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}