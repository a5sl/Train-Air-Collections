import React, { useEffect, useState, useRef } from 'react';
import { Train, Plane, Clock, MapPin, Trash2, ChevronRight, Search, Upload, Database, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Trip } from '../../../shared/types';
import Reveal from '../components/Reveal';
import Segmented from '../components/Segmented';
import TrajectorySVG from '../components/TrajectorySVG';
import { useToast } from '../components/fx/Toast';
import TrainLoader from '../components/fx/TrainLoader';

export default function TripList() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'train' | 'flight'>(() => {
    const saved = localStorage.getItem('tripListFilter');
    return (saved === 'train' || saved === 'flight') ? saved : 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(() => {
    const saved = localStorage.getItem('tripListSort');
    return (saved === 'asc' || saved === 'desc') ? saved : 'desc';
  });
  const updateSort = (val: 'desc' | 'asc') => { setSortOrder(val); localStorage.setItem('tripListSort', val); };
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast, confirmDlg } = useToast();
  const [tearingId, setTearingId] = useState<number | null>(null);

  const updateFilter = (val: 'all' | 'train' | 'flight') => { setFilter(val); localStorage.setItem('tripListFilter', val); };

  const loadTrips = () => { setLoading(true); api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { loadTrips(); }, []);

  const handleDelete = async (id: number) => {
    const ok = await confirmDlg({ title: '撕去此行？', message: '行程记录将永久移除，不可复得。', confirmText: '撕去', danger: true });
    if (!ok) return;
    setTearingId(id);
    setTimeout(async () => {
      try {
        await api.deleteTrip(id);
        setTrips(prev => prev.filter(t => t.id !== id));
        toast('已撕去一行行程');
      } catch { toast('删除失败', 'err'); }
      finally { setTearingId(null); }
    }, 520);
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result: any = await api.importTripsCSV(text);
      toast('导入毕: ' + result.imported + ' 条成功' + (result.errors.length > 0 ? ', ' + result.errors.length + ' 条失败' : ''));
      loadTrips();
    } catch (err: any) { toast('导入败: ' + err.message, 'err'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleSeed = async () => {
    try { const result: any = await api.seedData(); toast('已载入 ' + result.stations + ' 个站点, ' + result.operators + ' 个运营商'); }
    catch { toast('载入败', 'err'); }
  };

  const filtered = trips
    .filter(t => filter === 'all' ? true : t.type === filter)
    .filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (t.trainFlightNumber.toLowerCase().includes(q) || t.operator.toLowerCase().includes(q) ||
        t.departureStation?.name.toLowerCase().includes(q) || t.arrivalStation?.name.toLowerCase().includes(q) ||
        t.departureStation?.city.toLowerCase().includes(q) || t.arrivalStation?.city.toLowerCase().includes(q));
    })
    .sort((a, b) => { const da = parseDate(a.departureDate); const db = parseDate(b.departureDate); return sortOrder === 'desc' ? db - da : da - db; });

  function parseDate(s: string): number {
    if (!s) return 0;
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00Z').getTime();
    const ts = Date.parse(s);
    return isNaN(ts) ? 0 : ts;
  }

  const formatDuration = (mins: number | null) => {
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  };

  // Group by month for timeline
  const grouped = useMemo(() => {
    const map = new Map<string, Trip[]>();
    filtered.forEach(t => {
      const key = t.departureDate.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-content">行旅全录</h2>
          <p className="text-sm text-content-secondary mt-1">{trips.length} 条记录</p>
        </div>
        <div className="flex items-center gap-2">
          {seedMsg && <span className="text-xs text-brand">{seedMsg}</span>}
          <button onClick={handleSeed} className="btn-secondary text-xs" title="初始化车站和运营商数据">
            <Database className="w-3.5 h-3.5" />初始化数据
          </button>
          <input type="file" accept=".csv" ref={fileRef} onChange={handleCSVImport} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary text-xs">
            <Upload className="w-3.5 h-3.5" />{importing ? '导入中...' : '导入CSV'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Segmented
          options={[
            { value: 'all' as const, label: '全部' },
            { value: 'train' as const, label: '铁轨', icon: Train },
            { value: 'flight' as const, label: '云路', icon: Plane },
          ]}
          value={filter}
          onChange={updateFilter}
        />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input type="text" placeholder="搜索车次、运营商、站点..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} className="input-field pl-9" id="trip-search" />
        </div>
        <button onClick={() => updateSort(sortOrder === 'desc' ? 'asc' : 'desc')}
          className="px-3 py-1.5 rounded-md text-sm font-medium transition-all text-content-secondary hover:text-content flex items-center gap-1"
          title={sortOrder === 'desc' ? '当前: 最新在前' : '当前: 最早在前'}>
          <ArrowUpDown className="w-3.5 h-3.5" />时间
          {sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <TrainLoader className="max-w-xs mb-2" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse"><div className="h-4 w-24 bg-line rounded mb-2" /><div className="h-3 w-48 bg-line rounded" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-content-secondary">未见匹配之行旅</p></div>
      ) : (
        <div className="relative">
          {/* Timeline rail */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-line hidden md:block" />
          <div className="space-y-6">
            {grouped.map(([month, monthTrips]) => (
              <div key={month} className="relative">
                {/* Month station marker */}
                <div className="hidden md:flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full border-2 border-brand bg-surface flex items-center justify-center flex-shrink-0 z-10">
                    <span className="text-xs font-display font-bold text-brand">{parseInt(month.split('-')[1])}月</span>
                  </div>
                  <span className="font-mono text-xs text-content-tertiary">{month}</span>
                </div>
                <div className="space-y-2 md:ml-14">
                  {monthTrips.map((trip, idx) => (
                    <Reveal key={trip.id} delay={idx * 50}>
                      <div className={'card p-4 group transition-all hover:shadow-md hover:-translate-y-0.5' + (tearingId === trip.id ? ' tearing' : '')}>
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            trip.type === 'train' ? 'bg-brand/10 text-brand' : 'bg-brand/10 text-brand'
                          }`}>
                            {trip.type === 'train' ? <Train className="w-5 h-5" /> : <Plane className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-content">{trip.trainFlightNumber}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-tint text-brand">
                                {trip.type === 'train' ? '铁轨' : '云路'}
                              </span>
                              <span className="text-sm text-content-secondary">{trip.operator}</span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-sm text-content flex-wrap">
                              <span className="font-medium">{trip.departureStation?.name || '?'}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-content-tertiary" />
                              <span className="font-medium">{trip.arrivalStation?.name || '?'}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-xs text-content-secondary flex-wrap">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trip.departureDate} {trip.departureTime} - {trip.arrivalTime}</span>
                              {trip.durationMinutes && <span>{formatDuration(trip.durationMinutes)}</span>}
                              {trip.distanceKm && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.distanceKm} km</span>}
                            </div>
                            {(trip.trainName || trip.vehicleType || trip.seatClass) && (
                              <div className="mt-1.5 flex items-center gap-2 text-xs text-content-secondary flex-wrap">
                                {trip.trainName && <span>{trip.trainName}</span>}
                                {trip.vehicleType && <span>{trip.vehicleType}</span>}
                                {trip.vehicleNumber && <span>#{trip.vehicleNumber}</span>}
                                {trip.carriageNumber && <span>{trip.carriageNumber}车厢</span>}
                                {trip.seatClass && <span>{trip.seatClass}</span>}
                                {trip.seatNumber && <span>{trip.seatNumber}座</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {trip.cost && <span className="font-mono text-sm font-semibold text-content">{trip.currency || ''} {trip.cost.toLocaleString()}</span>}
                            <button onClick={() => navigate('/edit/' + trip.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-content-tertiary hover:text-brand" title="编辑行程"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(trip.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-content-tertiary hover:text-brand"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function useMemo<T>(fn: () => T, deps: any[]): T {
  return React.useMemo(fn, deps);
}
