import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  FlaskConical,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react'

const API = ''

interface Measure {
  key: string
  label: string
  reduction_pct: number
}

interface ScenarioResult {
  baseline_monthly: number
  baseline_annual: number
  projected_monthly: number
  projected_annual: number
  combined_reduction_pct: number
  incidents_saved_annual: number
  economic_saving_kzt: number
  measures_applied: string[]
  breakdown: { key: string; label: string; reduction_pct: number; incidents_saved: number }[]
  available_measures: Measure[]
}

function fmt_kzt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} млрд ₸`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₸`
  return `${n.toLocaleString()} ₸`
}

export default function Scenarios() {
  const [available, setAvailable] = useState<Measure[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)

  // Load available measures on mount (call with empty measures)
  useEffect(() => {
    fetch(`${API}/api/scenario`)
      .then((r) => r.json())
      .then((d: ScenarioResult) => {
        setAvailable(d.available_measures)
        setResult(d)
      })
      .catch(console.error)
      .finally(() => setInitialLoad(false))
  }, [])

  const calculate = () => {
    setLoading(true)
    const params = Array.from(selected)
      .map((m) => `measures=${encodeURIComponent(m)}`)
      .join('&')
    fetch(`${API}/api/scenario${params ? '?' + params : ''}`)
      .then((r) => r.json())
      .then(setResult)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (initialLoad) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>

  const reduction = result?.combined_reduction_pct ?? 0
  const reductionColor = reduction >= 40 ? '#10b981' : reduction >= 20 ? '#f59e0b' : '#64748b'

  const chartData = (result?.breakdown ?? []).map((b) => ({
    label: b.label.length > 28 ? b.label.slice(0, 28) + '…' : b.label,
    incidents_saved: b.incidents_saved,
    reduction_pct: b.reduction_pct,
  }))

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-start gap-3">
          <div className="p-2.5 bg-slate-600/30 rounded-lg">
            <FlaskConical size={18} className="text-slate-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Базовый (мес.)</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{result?.baseline_monthly ?? '—'}</p>
            <p className="text-xs text-slate-500">инцидентов</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-lg">
            <TrendingDown size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Снижение</p>
            <p className="text-2xl font-bold mt-1" style={{ color: reductionColor }}>
              {reduction > 0 ? `−${reduction.toFixed(1)}%` : '0%'}
            </p>
            <p className="text-xs text-slate-500">при выбранных мерах</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-lg">
            <ShieldCheck size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Предотвратить/год</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {result?.incidents_saved_annual?.toFixed(0) ?? '0'}
            </p>
            <p className="text-xs text-slate-500">инцидентов</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="p-2.5 bg-yellow-500/10 rounded-lg">
            <DollarSign size={18} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Экономия/год</p>
            <p className="text-lg font-bold text-yellow-400 mt-1">
              {result ? fmt_kzt(result.economic_saving_kzt) : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Measure selector */}
        <div className="card">
          <h2 className="section-title flex items-center gap-2">
            <FlaskConical size={18} /> Меры контроля
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Выберите меры для расчёта совокупного эффекта снижения инцидентов.
          </p>
          <div className="space-y-2">
            {available.map((m) => {
              const checked = selected.has(m.key)
              return (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border ${
                    checked
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-200'
                      : 'bg-slate-700/30 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  {checked
                    ? <CheckSquare size={16} className="text-emerald-400 flex-shrink-0" />
                    : <Square size={16} className="flex-shrink-0" />}
                  <span className="flex-1 text-sm">{m.label}</span>
                  <span className={`text-xs font-medium ${checked ? 'text-emerald-400' : 'text-slate-500'}`}>
                    −{m.reduction_pct}%
                  </span>
                </button>
              )
            })}
          </div>
          <button
            onClick={calculate}
            disabled={loading || selected.size === 0}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading
              ? <><RefreshCw size={14} className="animate-spin" /> Расчёт...</>
              : 'Рассчитать сценарий'}
          </button>
        </div>

        {/* Result */}
        <div className="space-y-4">
          {/* Before / After */}
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">До / После (в год)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/40 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Базовый сценарий</p>
                <p className="text-3xl font-bold text-slate-100">{result?.baseline_annual?.toFixed(0)}</p>
                <p className="text-xs text-slate-500">инцидентов/год</p>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Прогноз с мерами</p>
                <p className="text-3xl font-bold text-emerald-400">{result?.projected_annual?.toFixed(0)}</p>
                <p className="text-xs text-slate-500">инцидентов/год</p>
              </div>
            </div>
            {reduction > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Совокупное снижение</span>
                  <span className="text-emerald-400 font-medium">{reduction.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(reduction, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Breakdown chart */}
          {chartData.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Вклад каждой меры</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={140}
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => [`${v?.toFixed(1)}`, 'Предотвращено инц./год']}
                  />
                  <Bar dataKey="incidents_saved" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="#10b981" fillOpacity={0.7 + i * 0.05} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Methodology note */}
      <div className="card bg-slate-800/40 border-slate-700/50">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="text-slate-400 font-medium">Методика (Scenario Modeling):</span>{' '}
          Комбинированный эффект = 1 − ∏(1 − r_i), где r_i — коэффициент снижения каждой меры.
          Максимальное ограничение: 70% (реалистичный потолок для нефтегазовой отрасли).
          Экономический эффект: ~1 500 000 ₸ на предотвращённый инцидент (отраслевой бенчмарк РК).
        </p>
      </div>
    </div>
  )
}
