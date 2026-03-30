import React, { useEffect, useState } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import { TrendingDown, TrendingUp, Activity, Target, RefreshCw } from 'lucide-react'

const API = ''

const ALL_MODELS = [
  { key: 'arima',   label: 'ARIMA',              color: '#f59e0b' },
  { key: 'ets',     label: 'ETS (Holt-Winters)', color: '#a78bfa' },
  { key: 'linsine', label: 'LinReg + Sine',       color: '#22d3ee' },
  { key: 'gbr',     label: 'Gradient Boosting',   color: '#22c55e' },
  { key: 'lstm',    label: 'LSTM',                color: '#f472b6' },
] as const

type ModelKey = typeof ALL_MODELS[number]['key']

export default function Predictions() {
  const [selected, setSelected] = useState<Set<ModelKey>>(new Set(['arima']))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [btTab, setBtTab] = useState<string>('')

  const fetchData = (models: Set<ModelKey>) => {
    setLoading(true)
    const params = [...models].map((m) => `models=${m}`).join('&')
    fetch(`${API}/api/predictions?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData(selected) }, [])

  const toggleModel = (key: ModelKey) => {
    const next = new Set(selected)
    if (next.has(key) && next.size === 1) return // keep at least one
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
    fetchData(next)
  }

  if (loading && !data) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>
  if (!data) return <div className="card text-red-400">Ошибка загрузки данных.</div>

  const trend       = data.model_metrics?.trend
  const mae         = data.model_metrics?.mae
  const rmse        = data.model_metrics?.rmse
  const mape        = data.model_metrics?.mape
  const baselineMae = data.model_metrics?.baseline_mae
  const backtesting: any[] = data.backtesting || []
  const activeModels: string[] = data.active_models || ['arima']
  const modelsData  = data.models || {}

  // Build combined chart data: historical + per-model forecasts
  const historical = (data.historical || []).map((h: any) => ({
    month:  h.month,
    actual: h.actual,
  }))

  // Collect all forecast months (union across models)
  const forecastMonths: Set<string> = new Set()
  activeModels.forEach((mk) => {
    const mf = modelsData[mk]?.forecast || []
    mf.forEach((f: any) => forecastMonths.add(f.month))
  })

  // Build forecast map per model
  const forecastMaps: Record<string, Record<string, any>> = {}
  activeModels.forEach((mk) => {
    forecastMaps[mk] = {}
    ;(modelsData[mk]?.forecast || []).forEach((f: any) => {
      forecastMaps[mk][f.month] = f
    })
  })

  const forecastRows = [...forecastMonths].sort().map((month) => {
    const row: any = { month }
    activeModels.forEach((mk) => {
      const f = forecastMaps[mk]?.[month]
      if (f) {
        row[`${mk}_predicted`] = f.predicted
        row[`${mk}_lower`]     = f.lower
        row[`${mk}_upper`]     = f.upper
      }
    })
    return row
  })

  const chartData = [...historical, ...forecastRows]
  const splitMonth = historical[historical.length - 1]?.month

  const primaryKey = activeModels[0] as ModelKey
  const primaryForecast = modelsData[primaryKey]?.forecast || data.forecast || []
  const nextMonthPredicted = primaryForecast[0]?.predicted?.toFixed(1) ?? '—'
  const nextMonthUpper     = primaryForecast[0]?.upper?.toFixed(1) ?? '—'
  const nextMonthLower     = primaryForecast[0]?.lower?.toFixed(1) ?? '—'

  const historicalAvg =
    historical.length > 0
      ? (historical.reduce((s: number, h: any) => s + (h.actual ?? 0), 0) / historical.length).toFixed(1)
      : '—'
  const forecastAvg =
    primaryForecast.length > 0
      ? (primaryForecast.reduce((s: number, f: any) => s + (f.predicted ?? 0), 0) / primaryForecast.length).toFixed(1)
      : '—'

  const modelColor = (key: string) => ALL_MODELS.find((m) => m.key === key)?.color ?? '#94a3b8'
  const modelLabel = (key: string) => ALL_MODELS.find((m) => m.key === key)?.label ?? key.toUpperCase()

  return (
    <div className="space-y-6">
      {/* Model selector */}
      <div className="card py-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Модели:</span>
          {ALL_MODELS.map(({ key, label, color }) => {
            const active = selected.has(key)
            return (
              <button
                key={key}
                onClick={() => toggleModel(key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  active
                    ? 'bg-slate-700 border-slate-500 text-slate-100'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: active ? color : '#475569' }}
                />
                {label}
              </button>
            )
          })}
          {loading && (
            <RefreshCw size={13} className="text-slate-500 animate-spin ml-auto" />
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10">
            {trend === 'decreasing'
              ? <TrendingDown size={20} className="text-emerald-400" />
              : <TrendingUp size={20} className="text-red-400" />}
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Тренд</p>
            <p className={`text-lg font-bold mt-1 ${trend === 'decreasing' ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend === 'decreasing' ? 'Снижение' : 'Рост'}
            </p>
            <p className="text-xs text-slate-500">
              MAE: {mae}{rmse != null ? ` · RMSE: ${rmse}` : ''}{mape != null ? ` · MAPE: ${mape}%` : ''}
            </p>
          </div>
        </div>

        <div className="card flex items-start gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10">
            <Target size={20} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Прогноз (след. мес.)</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{nextMonthPredicted}</p>
            <p className="text-xs text-slate-500">[{nextMonthLower} — {nextMonthUpper}]</p>
          </div>
        </div>

        <div className="card flex items-start gap-4">
          <div className="p-3 rounded-lg bg-slate-600/30">
            <Activity size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Среднее (факт)</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{historicalAvg}</p>
            <p className="text-xs text-slate-500">инцидентов / мес.</p>
          </div>
        </div>

        <div className="card flex items-start gap-4">
          <div className="p-3 rounded-lg bg-purple-500/10">
            <Activity size={20} className="text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Среднее (прогноз)</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{forecastAvg}</p>
            <p className="text-xs text-slate-500">инцидентов / мес.</p>
          </div>
        </div>
      </div>

      {/* Main chart */}
      <div className="card">
        <h2 className="section-title">Прогноз инцидентов на 12 месяцев</h2>
        <p className="text-xs text-slate-500 mb-4">
          Синяя линия — исторические данные. Цветные линии — прогнозы выбранных моделей. Полупрозрачная область — доверительный интервал 95%.
        </p>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(v: string) => v?.slice(2)}
            />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value: any, name: string) => {
                if (!value && value !== 0) return [null, name]
                const v = typeof value === 'number' ? value.toFixed(1) : value
                if (name === 'actual') return [v, 'Факт']
                const modelKey = name.replace(/_predicted|_lower|_upper/, '')
                const label = modelLabel(modelKey)
                if (name.endsWith('_predicted')) return [v, `${label} — прогноз`]
                if (name.endsWith('_upper'))     return [v, `${label} — верхняя`]
                if (name.endsWith('_lower'))     return [v, `${label} — нижняя`]
                return [v, name]
              }}
            />
            <Legend
              formatter={(value) => {
                if (value === 'actual') return 'Факт'
                const modelKey = value.replace(/_predicted|_lower|_upper/, '')
                const label = modelLabel(modelKey)
                if (value.endsWith('_predicted')) return label
                return null
              }}
            />
            {splitMonth && (
              <ReferenceLine
                x={splitMonth}
                stroke="#64748b"
                strokeDasharray="6 3"
                label={{ value: 'Сегодня', position: 'top', fill: '#64748b', fontSize: 11 }}
              />
            )}

            {/* Confidence bands */}
            {activeModels.map((mk) => (
              <Area
                key={`${mk}_upper`}
                dataKey={`${mk}_upper`}
                stroke="none"
                fill={modelColor(mk)}
                fillOpacity={0.07}
                connectNulls={false}
                legendType="none"
              />
            ))}

            {/* Historical */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#3b82f6' }}
              connectNulls={false}
            />

            {/* Forecast lines */}
            {activeModels.map((mk) => (
              <Line
                key={`${mk}_predicted`}
                type="monotone"
                dataKey={`${mk}_predicted`}
                stroke={modelColor(mk)}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: modelColor(mk) }}
                connectNulls={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Per-model metrics comparison */}
      {activeModels.length > 1 && (
        <div className="card">
          <h2 className="section-title">Сравнение метрик моделей</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Модель', 'MAE', 'RMSE', 'MAPE', 'Метод'].map((h) => (
                    <th key={h} className="text-left py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeModels.map((mk) => {
                  const m = modelsData[mk]?.metrics
                  const isPrimary = mk === primaryKey
                  return (
                    <tr key={mk} className={`border-b border-slate-700/50 ${isPrimary ? 'bg-slate-700/20' : ''}`}>
                      <td className="py-2.5 px-4">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: modelColor(mk) }} />
                          <span className="text-slate-200 font-medium">{modelLabel(mk)}</span>
                          {isPrimary && <span className="text-xs text-slate-500">(основная)</span>}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">{m?.mae ?? '—'}</td>
                      <td className="py-2.5 px-4 text-slate-300">{m?.rmse ?? '—'}</td>
                      <td className="py-2.5 px-4 text-slate-300">{m?.mape != null ? `${m.mape}%` : '—'}</td>
                      <td className="py-2.5 px-4 text-violet-400 font-mono text-xs">{m?.method ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Forecast table (primary model) */}
      <div className="card">
        <h2 className="section-title">Детализация прогноза — {modelLabel(primaryKey)}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Месяц', 'Прогноз', 'Нижняя граница', 'Верхняя граница', 'Диапазон'].map((h) => (
                  <th key={h} className="text-left py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {primaryForecast.map((row: any, i: number) => (
                <tr key={i} className={`border-b border-slate-700/50 ${i === 0 ? 'bg-blue-500/5' : 'hover:bg-slate-700/30'} transition-colors`}>
                  <td className="py-2.5 px-4 text-slate-300 font-medium">{row.month}</td>
                  <td className="py-2.5 px-4 font-bold" style={{ color: modelColor(primaryKey) }}>{row.predicted?.toFixed(1)}</td>
                  <td className="py-2.5 px-4 text-slate-400">{row.lower?.toFixed(1)}</td>
                  <td className="py-2.5 px-4 text-slate-400">{row.upper?.toFixed(1)}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">± {((row.upper - row.lower) / 2).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backtesting — per model tabs */}
      {(() => {
        const modelsWithBt = activeModels.filter((mk) => (modelsData[mk]?.backtesting?.length ?? 0) > 0)
        if (modelsWithBt.length === 0) return null
        const activeBtKey = btTab && modelsWithBt.includes(btTab) ? btTab : modelsWithBt[0]
        const bt: any[] = modelsData[activeBtKey]?.backtesting ?? []
        const m = modelsData[activeBtKey]?.metrics ?? {}
        return (
          <div className="card">
            <h2 className="section-title">Бэктестинг — out-of-sample валидация</h2>
            <p className="text-xs text-slate-500 mb-3">
              Последние {bt.length} мес. — тестовая выборка (модель их не видела при обучении).
              {m.baseline_mae != null && (
                <> Naive baseline MAE: <span className="text-slate-300">{m.baseline_mae}</span> — модель его{' '}
                <span className={m.mae != null && m.mae < m.baseline_mae ? 'text-emerald-400' : 'text-red-400'}>
                  {m.mae != null && m.mae < m.baseline_mae ? 'превосходит' : 'не превосходит'}
                </span>.</>
              )}
            </p>

            {/* Model tabs */}
            <div className="flex gap-1 mb-4 flex-wrap">
              {modelsWithBt.map((mk) => {
                const active = mk === activeBtKey
                return (
                  <button
                    key={mk}
                    onClick={() => setBtTab(mk)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      active
                        ? 'bg-slate-700 border-slate-500 text-slate-100'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: active ? modelColor(mk) : '#475569' }} />
                    {modelLabel(mk)}
                  </button>
                )
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Месяц', 'Факт', 'Прогноз', 'Ошибка', 'Ошибка %'].map((h) => (
                      <th key={h} className="text-left py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bt.map((row: any, i: number) => {
                    const errPct = row.actual > 0 ? ((row.error / row.actual) * 100).toFixed(1) : '—'
                    const good = row.error <= row.actual * 0.2
                    return (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="py-2 px-4 text-slate-300 font-medium">{row.month}</td>
                        <td className="py-2 px-4 text-blue-400 font-bold">{row.actual}</td>
                        <td className="py-2 px-4 font-medium" style={{ color: modelColor(activeBtKey) }}>{row.predicted}</td>
                        <td className="py-2 px-4">
                          <span className={good ? 'text-emerald-400' : 'text-orange-400'}>{row.error}</span>
                        </td>
                        <td className="py-2 px-4 text-slate-500 text-xs">{errPct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 pt-3 border-t border-slate-700/50">
              {m.mae  != null && <span>MAE: <span className="text-slate-200 font-medium">{m.mae}</span></span>}
              {m.rmse != null && <span>RMSE: <span className="text-slate-200 font-medium">{m.rmse}</span></span>}
              {m.mape != null && <span>MAPE: <span className="text-slate-200 font-medium">{m.mape}%</span></span>}
              {m.baseline_mae != null && <span>Baseline MAE: <span className="text-slate-400">{m.baseline_mae}</span></span>}
            </div>
          </div>
        )
      })()}

      {/* Model info */}
      <div className="card bg-slate-800/50">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">О моделях</h3>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          {activeModels.map((mk) => {
            const m = modelsData[mk]?.metrics
            return (
              <span key={mk} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: modelColor(mk) }} />
                <span style={{ color: modelColor(mk) }} className="font-medium">{m?.method ?? modelLabel(mk)}</span>
                {m?.aic != null && <span className="text-slate-600">AIC {m.aic}</span>}
              </span>
            )
          })}
          <span className="text-slate-600 ml-auto">Доверительный интервал 95%</span>
        </div>
      </div>
    </div>
  )
}
