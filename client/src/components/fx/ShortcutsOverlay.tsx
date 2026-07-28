import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const ROWS: Array<{ keys: string[]; label: string }> = [
  { keys: ['G', 'D'], label: '前往概览' },
  { keys: ['G', 'T'], label: '前往行旅全录' },
  { keys: ['G', 'M'], label: '前往舆图' },
  { keys: ['G', 'A'], label: '启程录新程' },
  { keys: ['/'], label: '聚焦搜索' },
  { keys: ['?'], label: '开关本须知' },
  { keys: ['G', '1'], label: '鸣笛……（试试）' },
];

/** 驿馆须知：全局快捷键浮层。 */
export default function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 overlay-in"
      onClick={onClose}
    >
      <div className="card w-[340px] max-w-[90vw] p-5 dialog-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-content">驿馆须知</h3>
          <button onClick={onClose} className="text-content-tertiary hover:text-content transition-colors" aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-content-secondary mb-4">键走驿路，指下生风。</p>
        <div className="space-y-2.5">
          {ROWS.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-sm text-content">{r.label}</span>
              <span className="flex items-center gap-1">
                {r.keys.map((k, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-content-tertiary text-xs">→</span>}
                    <kbd className="keycap">{k}</kbd>
                  </React.Fragment>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}