import React, { useEffect, useRef, useState } from 'react';
import { HardDriveDownload, HardDriveUpload, History, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './fx/Toast';

interface BackupInfo { name: string; size: number; modifiedAt: string; }

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

export default function BackupPopover({ onRestored }: { onRestored: () => void }) {
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const { toast, confirmDlg } = useToast();

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    api.listBackups().then(setBackups).catch(() => setBackups([]));
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleDownload = async () => {
    setBusy(true);
    try { await api.downloadBackup(); toast('备份已下载'); }
    catch { toast('备份下载失败', 'err'); }
    finally { if (mountedRef.current) setBusy(false); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const ok = await confirmDlg({
      title: '恢复备份？',
      message: '当前全部行程数据将被此备份覆盖（会先自动留存一份当前数据）。',
      confirmText: '覆盖恢复',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.restoreBackup(file);
      toast('恢复毕：' + r.tripCount + ' 条行程');
      if (mountedRef.current) { setOpen(false); onRestored(); }
    } catch (err: any) { toast('恢复败：' + err.message, 'err'); }
    finally { if (mountedRef.current) setBusy(false); }
  };

  const handleRestoreByName = async (b: BackupInfo) => {
    const ok = await confirmDlg({
      title: '恢复此备份？',
      message: '将用 ' + formatTime(b.modifiedAt) + ' 的备份覆盖当前数据（会先自动留存一份当前数据）。',
      confirmText: '覆盖恢复',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.restoreBackupByName(b.name);
      toast('恢复毕：' + r.tripCount + ' 条行程');
      if (mountedRef.current) { setOpen(false); onRestored(); }
    } catch (err: any) { toast('恢复败：' + err.message, 'err'); }
    finally { if (mountedRef.current) setBusy(false); }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button onClick={() => setOpen(v => !v)} className="btn-secondary text-xs" title="备份与恢复">
        <HardDriveDownload className="w-3.5 h-3.5" />备份
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 card p-3 z-[110] space-y-3" style={{ boxShadow: 'var(--shadow-pop)' }}>
          <div className="flex gap-2">
            <button onClick={handleDownload} disabled={busy} className="btn-secondary text-xs flex-1">
              <HardDriveDownload className="w-3.5 h-3.5" />下载备份
            </button>
            <input type="file" accept=".db,.sqlite,.sqlite3" ref={fileRef} onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary text-xs flex-1">
              <HardDriveUpload className="w-3.5 h-3.5" />恢复文件
            </button>
          </div>
          <div>
            <p className="text-xs text-content-secondary flex items-center gap-1 mb-1.5">
              <History className="w-3 h-3" />自动备份（启动时留存，最近 10 份）
            </p>
            {backups.length === 0 ? (
              <p className="text-xs text-content-tertiary py-1">暂无自动备份</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {backups.map(b => (
                  <li key={b.name} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-line last:border-0">
                    <span className="text-content-secondary truncate">
                      {formatTime(b.modifiedAt)} · {formatSize(b.size)}
                    </span>
                    <button onClick={() => handleRestoreByName(b)} disabled={busy}
                      className="text-brand hover:opacity-80 flex items-center gap-0.5 flex-shrink-0">
                      <RotateCcw className="w-3 h-3" />恢复
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
