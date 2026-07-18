import React, { useState, useRef, useEffect } from "react";
import { Search, Plus, X } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

export default function OperatorPicker({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newOp, setNewOp] = useState({ name: "", type: "railway", region: "" });
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 1) { setResults([]); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await (api as any).getOperators(q);
        setResults(data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 200);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    search(v);
    setOpen(true);
  };

  const selectOp = (name: string) => {
    setQuery(name);
    onChange(name);
    setOpen(false);
  };

  const handleAdd = async () => {
    if (!newOp.name || !newOp.region) return;
    try {
      await (api as any).createOperator(newOp);
      selectOp(newOp.name);
      setShowAdd(false);
      setNewOp({ name: "", type: "railway", region: "" });
    } catch { alert("添败"); }
  };

  return (
    <div ref={ref} className="relative">
      <label className="label-text">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input className="input-field pl-9" placeholder={placeholder}
          value={query} onChange={handleInput} onFocus={() => { if (query) setOpen(true); }} />
        {value && (
          <button onClick={() => { setQuery(""); onChange(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-500">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-parchment-50 rounded-lg border border-terracotta-200 shadow-lg max-h-56 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-ink-400">索中…</div>}
          {!loading && results.length === 0 && query && (
            <div className="px-3 py-2">
              <p className="text-sm text-ink-400 mb-2">未得</p>
              {!showAdd ? (
                <button onClick={() => setShowAdd(true)}
                  className="text-sm text-terracotta-500 font-medium hover:text-terracotta-600 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> 添运营方
                </button>
              ) : (
                <div className="space-y-2 p-2 bg-parchment-100 rounded-lg">
                  <input className="input-field" placeholder="名称 *" value={newOp.name}
                    onChange={e => setNewOp(p => ({...p, name: e.target.value}))} />
                  <div className="flex gap-2">
                    <select className="select-field flex-1" value={newOp.type}
                      onChange={e => setNewOp(p => ({...p, type: e.target.value}))}>
                      <option value="railway">铁路</option>
                      <option value="airline">航空</option>
                      <option value="other">其他</option>
                    </select>
                    <input className="input-field flex-1" placeholder="地区 *" value={newOp.region}
                      onChange={e => setNewOp(p => ({...p, region: e.target.value}))} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAdd} className="btn-primary text-xs py-1.5 flex-1">创</button>
                    <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs py-1.5">罢</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {results.map((o: any) => (
            <div key={o.id} onClick={() => selectOp(o.name)} className="station-option">
              <span className="font-medium text-ink-800">{o.name}</span>
              <span className="text-ink-400 ml-2 text-xs">{o.region} · {o.type === "railway" ? "铁路" : o.type === "airline" ? "航空" : "其他"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
