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
  DollarSign,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  FileText,
  BarChart3,
  Cpu,
} from 'lucide-react'

const API = ''

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс.`
  return String(n)
}

const SAVINGS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  direct_costs:       { label: 'Прямые затраты',         icon: <ShieldCheck size={16} />,  color: '#3b82f6' },
  indirect_costs:     { label: 'Косвенные затраты',       icon: <TrendingDown size={16} />, color: '#10b981' },
  fines_reduction:    { label: 'Снижение штрафов',        icon: <AlertTriangle size={16} />, color: '#f59e0b' },
  investigation_savings: { label: 'Расследования',        icon: <FileText size={16} />,     color: '#8b5cf6' },
  audit_efficiency:   { label: 'Эффективность аудитов',   icon: <BarChart3 size={16} />,    color: '#06b6d4' },
}

export default function EconomicEffect() {
  const [data, setData] = useState<any>(null)
  const [corrData, setCorrData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/economic-effect`).then((r) => r.json()),
      fetch(`${API}/api/correlation`).then((r) => r.json()),
    ])
      .then(([e, c]) => { setData(e); setCorrData(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>
  if (!data) return <div className="card text-red-400">Ошибка загрузки данных.</div>

  const savings = data.savings || {}
  const totalKzt = savings.total || 0

  const chartData = Object.entries(savings)
    .filter(([k]) => k !== 'total')
    .map(([key, value]) => ({
      key,
      label: SAVINGS_LABELS[key]?.label ?? key,
      value: value as number,
      color: SAVINGS_LABELS[key]?.color ?? '#3b82f6',
    }))

  const corrCoeff = corrData?.correlation_coefficient ?? 0
  const corrAbs = Math.abs(corrCoeff)
  const corrPct = Math.round(corrAbs * 100)
  const corrPositive = corrCoeff > 0

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="card bg-gradient-to-br from-blue-600/20 to-blue-900/20 border-blue-500/30">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-blue-300 uppercase tracking-wide font-medium">
              Общий экономический эффект
            </p>
            <p className="text-4xl font-black text-white mt-2">
              {fmt(totalKzt)} {data.currency}
            </p>
            <p className="text-sm text-blue-300 mt-1">
              от внедрения HSE AI Analytics системы
            </p>
          </div>
          <div className="p-4 bg-blue-500/20 rounded-xl">
            <DollarSign size={32} className="text-blue-300" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-blue-500/20">
          <div>
            <p className="text-xs text-blue-400">Снижение инцидентов</p>
            <p className="text-xl font-bold text-white">{data.predicted_reduction_pct}%</p>
          </div>
          <div>
            <p className="text-xs text-blue-400">Предотвращено НС</p>
            <p className="text-xl font-bold text-white">{data.prevented_accidents}</p>
          </div>
          <div>
            <p className="text-xs text-blue-400">Предотвращено микротравм</p>
            <p className="text-xl font-bold text-white">{data.prevented_microtraumas}</p>
          </div>
        </div>
      </div>

      {/* Savings breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="card">
          <h2 className="section-title">Структура экономии</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + '…' : v)}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: number) => fmt(v)}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: any) => [`${fmt(v as number)} ${data.currency}`, 'Экономия']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Экономия">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed cards */}
        <div className="space-y-3">
          {chartData.map((item) => {
            const pct = Math.round((item.value / totalKzt) * 100)
            const meta = SAVINGS_LABELS[item.key]
            return (
              <div key={item.key} className="card-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: item.color }}>{meta?.icon}</span>
                    <span className="text-sm text-slate-300">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-100">
                    {fmt(item.value)} {data.currency}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, background: item.color }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Correlation */}
      <div className="card">
        <h2 className="section-title flex items-center gap-2">
          <Cpu size={18} /> Корреляция нарушений и инцидентов
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col items-center justify-center p-4 bg-slate-700/30 rounded-xl">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Коэффициент Пирсона</p>
            <p
              className="text-4xl font-black"
              style={{ color: corrPositive ? '#ef4444' : '#10b981' }}
            >
              {corrCoeff?.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {corrCoeff > 0.5 ? 'Сильная' : corrCoeff > 0.3 ? 'Умеренная' : 'Слабая'} корреляция
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-slate-700/30 rounded-xl">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Лаг</p>
            <p className="text-4xl font-black text-blue-400">{corrData?.lag_days ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">дней опережения</p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-slate-700/30 rounded-xl">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Объяснённость</p>
            <p className="text-4xl font-black text-purple-400">{corrPct}%</p>
            <p className="text-xs text-slate-500 mt-1">предсказуемости</p>
          </div>
        </div>

        {corrData?.description && (
          <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
            <p className="text-sm text-slate-400 leading-relaxed">{corrData.description}</p>
          </div>
        )}

        {/* Correlation bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>-1 (обратная)</span>
            <span>0 (нет связи)</span>
            <span>+1 (прямая)</span>
          </div>
          <div className="relative w-full bg-slate-700 rounded-full h-3">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-500" />
            <div
              className="absolute top-0 h-3 rounded-full transition-all"
              style={{
                background: corrPositive ? '#ef4444' : '#10b981',
                left: corrPositive ? '50%' : `${50 - corrPct / 2}%`,
                width: `${corrPct / 2}%`,
              }}
            />
            <div
              className="absolute top-0 w-3 h-3 rounded-full bg-white border-2 border-slate-900"
              style={{
                left: `calc(${50 + corrCoeff * 50}% - 6px)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ROI summary */}
      <div className="card bg-emerald-500/5 border-emerald-500/20">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3">Итоговое резюме</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500">Инцидентов за период</p>
            <p className="text-xl font-bold text-slate-200 mt-1">{data.incidents_per_year}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Прогноз снижения</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">−{data.predicted_reduction_pct}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Экономия в год</p>
            <p className="text-xl font-bold text-blue-400 mt-1">{fmt(totalKzt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Валюта</p>
            <p className="text-xl font-bold text-slate-200 mt-1">{data.currency}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
