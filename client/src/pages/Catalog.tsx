import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Train, Barcode, Search, ChevronDown, ChevronUp, Pencil, BookOpen, Camera } from 'lucide-react';
import { api } from '../lib/api';
import type { Trip } from '../../../shared/types';
import { buildCatalog, type CatalogEntry } from '../lib/catalog';
import Segmented from '../components/Segmented';
import CountUp from '../components/CountUp';
import Reveal from '../components/Reveal';
import TrainLoader from '../components/fx/TrainLoader';
import AirlineLogo from '../components/AirlineLogo';

type Tab = 'flights' | 'trains' | 'registrations';

function formatDuration(minutes: number): string {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function EntryCard({ entry, expanded, onToggle, onEdit }: { entry: CatalogEntry; expanded: boolean; onToggle: () => void; onEdit: (id: number) => void }) {
  const isFlight = entry.type === 'flight';
  const accent = isFlight ? 'rgb(var(--c-flight-line))' : 'rgb(var(--c-train-line))';
  const Icon = isFlight ? Plane : Train;
  const photos = useMemo(() => {
    const seen = new Set<string>();
    const out: { url: string; alt: string }[] = [];
    for (const t of entry.trips) {
      for (const img of t.images || []) {
        if (seen.has(img.url)) continue;
        seen.add(img.url);
        out.push({ url: img.url, alt: img.originalName || t.trainFlightNumber });
        if (out.length >= 6) return out;
      }
    }
    return out;
  }, [entry.trips]);

  return (
    <Reveal>
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <span
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border"
            style={{ color: accent, borderColor: 'rgb(var(--c-line))', background: 'rgb(var(--c-surface-card-alt))' }}
          >
            <Icon className="w-5 h-5" />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-xl font-bold text-content truncate">{entry.label}</h3>
              <span className="font-mono text-xs px-1.5 py-0.5 rounded border border-line text-content-secondary">
                ×{entry.count}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2 text-xs text-content-secondary font-mono flex-wrap">
              <span>
                里程 <CountUp value={entry.totalKm} className="text-content font-semibold" format={(n) => n.toLocaleString()} /> km
              </span>
              <span>历时 {formatDuration(entry.totalMinutes)}</span>
              <span className="text-content-tertiary">{entry.firstDate} → {entry.lastDate}</span>
            </div>

            {entry.operators.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {entry.operators.map((op) =>
                  isFlight ? (
                    <span key={op.name} className="inline-flex items-center gap-1.5 text-xs text-content-secondary">
                      <AirlineLogo flightNumber={op.flightNumber} operator={op.name} size={18} />
                      <span
                        className="truncate max-w-[9rem]"
                        title={op.marketing.length > 0 ? `${op.name}（${op.marketing.join(' / ')} 代码共享）` : op.name}
                      >
                        {op.name}
                      </span>
                    </span>
                  ) : (
                    <span key={op.name} className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-card-alt border border-line text-[11px] text-content-secondary">
                      {op.name}
                    </span>
                  )
                )}
              </div>
            )}

            {entry.variants.length > 1 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {entry.variants.map((v) => (
                  <span key={v.label} className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-dashed border-line text-content-tertiary">
                    {v.label} ×{v.count}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onToggle}
            className="flex-shrink-0 w-8 h-8 rounded-lg border border-line bg-surface-card-alt flex items-center justify-center text-content-secondary hover:text-brand transition-colors"
            aria-label={expanded ? '收起行程' : '展开行程'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {photos.length > 0 && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto">
            {photos.map((p) => (
              <img key={p.url} src={p.url} alt={p.alt} loading="lazy" decoding="async"
                className="w-16 h-16 rounded-md object-cover bg-surface-card-alt ring-1 ring-line-subtle flex-shrink-0" />
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-line space-y-1.5">
            {entry.trips.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-surface-card-alt transition-colors group">
                <span className="font-mono text-content-tertiary flex-shrink-0">{t.departureDate}</span>
                <span
                  className="font-mono text-[11px] px-1.5 py-0.5 rounded border flex-shrink-0"
                  style={{ color: t.type === 'flight' ? 'rgb(var(--c-flight-line))' : 'rgb(var(--c-train-line))', borderColor: 'rgb(var(--c-line))' }}
                >
                  {t.trainFlightNumber}
                </span>
                <span className="text-content-secondary truncate min-w-0">
                  {t.departureStation?.name || '?'} → {t.arrivalStation?.name || '?'}
                </span>
                {t.isCodeshare && t.operatingCarrier && (
                  <span className="text-[10px] font-mono px-1 py-0.5 rounded border border-dashed border-line text-content-tertiary flex-shrink-0" title={`缔约承运：${t.operator}`}>
                    共享 · {t.operatingCarrier}执飞
                  </span>
                )}
                {t.vehicleNumber && <span className="font-mono text-content-tertiary flex-shrink-0">{t.vehicleNumber}</span>}
                <span className="font-mono text-content-tertiary flex-shrink-0 hidden sm:inline">
                  {t.distanceKm != null ? `${t.distanceKm.toLocaleString()} km` : ''}
                </span>
                {(t.images?.length || 0) > 0 && <Camera className="w-3 h-3 text-content-tertiary flex-shrink-0" />}
                <Pencil className="w-3.5 h-3.5 text-content-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto"
                  role="button" tabIndex={0} aria-label="编辑此行程"
                  onClick={(e) => { e.stopPropagation(); onEdit(t.id); }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}

export default function Catalog() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('flights');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  const catalog = useMemo(() => buildCatalog(trips), [trips]);

  const entries = useMemo(() => {
    const list = tab === 'flights' ? catalog.flights : tab === 'trains' ? catalog.trains : catalog.registrations;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.variants.some((v) => v.label.toLowerCase().includes(q)) ||
        e.operators.some((o) => o.name.toLowerCase().includes(q))
    );
  }, [catalog, tab, query]);

  const summary = useMemo(() => {
    const families = tab === 'flights' ? catalog.flights.length : tab === 'trains' ? catalog.trains.length : catalog.registrations.length;
    const rides = entries.reduce((s, e) => s + e.count, 0);
    const operators = new Set<string>();
    entries.forEach((e) => e.operators.forEach((o) => operators.add(o.name)));
    return { families, rides, operators: operators.size };
  }, [catalog, tab, entries]);

  const EMPTY_HINTS: Record<Tab, string> = {
    flights: '尚未录入航班机型——录程时填写「机型」即可自动归集',
    trains: '尚未录入火车车型——录程时填写「车型」即可自动归集',
    registrations: '尚未录入注册号——录程时填写「注册号/车组号」即可自动归集',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <TrainLoader className="max-w-xs" />
        <div className="h-7 w-24 bg-line rounded animate-pulse" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse space-y-2">
              <div className="h-5 w-20 bg-line rounded" />
              <div className="h-3 w-32 bg-line rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-content flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-brand" /> 收藏图鉴
        </h2>
        <p className="text-sm text-content-secondary mt-1">机型 · 车型 · 注册号，一切坐过的，都值得收藏</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'flights', label: '机型', icon: Plane },
            { value: 'trains', label: '车型', icon: Train },
            { value: 'registrations', label: '注册号', icon: Barcode },
          ]}
        />
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索族系 / 变体 / 运营方"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-surface-card text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-content-secondary font-mono">
        <span>
          {tab === 'flights' ? '机型' : tab === 'trains' ? '车型' : '注册号'}族系
          <CountUp value={summary.families} className="text-content font-semibold ml-1" />
        </span>
        <span>
          总乘坐 <CountUp value={summary.rides} className="text-content font-semibold ml-1" /> 次
        </span>
        <span>
          覆盖运营方 <CountUp value={summary.operators} className="text-content font-semibold ml-1" />
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="flex justify-center mb-4"><Barcode className="w-10 h-10 text-content-tertiary" /></div>
          <p className="text-sm text-content-secondary">{query ? '未见匹配的收藏条目' : EMPTY_HINTS[tab]}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {entries.map((e) => (
            <EntryCard
              key={e.key}
              entry={e}
              expanded={expanded === e.key}
              onToggle={() => setExpanded(expanded === e.key ? null : e.key)}
              onEdit={(id) => navigate('/edit/' + id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}