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
import { TrendingDown, TrendingUp, Activity, Target } from 'lucide-react'

const API = ''

export default function Predictions() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/predictions`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>
  if (!data) return <div className="card text-red-400">Ошибка загрузки данных.</div>

  const trend = data.model_metrics?.trend
  const mae = data.model_metrics?.mae
  const method = data.model_metrics?.method ?? 'ARIMA'
  const aic = data.model_metrics?.aic

  // Build combined chart data
  const historical = (data.historical || []).map((h: any) => ({
    month: h.month,
    actual: h.actual,
    predicted: null,
    lower: null,
    upper: null,
    isForecast: false,
  }))

  const forecast = (data.forecast || []).map((f: any) => ({
    month: f.month,
    actual: null,
    predicted: f.predicted,
    lower: f.lower,
    upper: f.upper,
    isForecast: true,
  }))

  const chartData = [...historical, ...forecast]

  // Find the split point label
  const splitMonth = historical[historical.length - 1]?.month

  const nextMonthPredicted = data.forecast?.[0]?.predicted?.toFixed(1) ?? '—'
  const nextMonthUpper = data.forecast?.[0]?.upper?.toFixed(1) ?? '—'
  const nextMonthLower = data.forecast?.[0]?.lower?.toFixed(1) ?? '—'

  const historicalAvg =
    historical.length > 0
      ? (historical.reduce((s: number, h: any) => s + (h.actual ?? 0), 0) / historical.length).toFixed(1)
      : '—'

  const forecastAvg =
    forecast.length > 0
      ? (forecast.reduce((s: number, f: any) => s + (f.predicted ?? 0), 0) / forecast.length).toFixed(1)
      : '—'

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10">
            {trend === 'decreasing' ? (
              <TrendingDown size={20} className="text-emerald-400" />
            ) : (
              <TrendingUp size={20} className="text-red-400" />
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Тренд</p>
            <p className={`text-lg font-bold mt-1 ${trend === 'decreasing' ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend === 'decreasing' ? 'Снижение' : 'Рост'}
            </p>
            <p className="text-xs text-slate-500">MAE: {mae}</p>
          </div>
        </div>

        <div className="card flex items-start gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10">
            <Target size={20} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Прогноз (след. мес.)</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{nextMonthPredicted}</p>
            <p className="text-xs text-slate-500">
              [{nextMonthLower} — {nextMonthUpper}]
            </p>
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

      {/* Main forecast chart */}
      <div className="card">
        <h2 className="section-title">Прогноз инцидентов на 12 месяцев</h2>
        <p className="text-xs text-slate-500 mb-4">
          Синяя линия — исторические данные. Оранжевая — прогноз. Серая область — доверительный интервал 95%.
        </p>
        <ResponsiveContainer width="100%" height={360}>
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
                if (name === 'upper' || name === 'lower') return [value?.toFixed(1), name === 'upper' ? 'Верхняя граница' : 'Нижняя граница']
                return [value?.toFixed ? value.toFixed(1) : value, name === 'actual' ? 'Факт' : 'Прогноз']
              }}
            />
            <Legend
              formatter={(value) => {
                const map: Record<string, string> = {
                  actual: 'Факт',
                  predicted: 'Прогноз',
                  upper: 'Верхняя граница',
                  lower: 'Нижняя граница',
                }
                return map[value] ?? value
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
            {/* Confidence band */}
            <Area
              dataKey="upper"
              stroke="none"
              fill="#f59e0b"
              fillOpacity={0.08}
              connectNulls={false}
            />
            <Area
              dataKey="lower"
              stroke="none"
              fill="#f59e0b"
              fillOpacity={0.08}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#3b82f6' }}
              name="actual"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: '#f59e0b' }}
              name="predicted"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast table */}
      <div className="card">
        <h2 className="section-title">Детализация прогноза</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Месяц', 'Прогноз', 'Нижняя граница', 'Верхняя граница', 'Диапазон'].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.forecast || []).map((row: any, i: number) => (
                <tr
                  key={i}
                  className={`border-b border-slate-700/50 ${
                    i === 0 ? 'bg-blue-500/5' : 'hover:bg-slate-700/30'
                  } transition-colors`}
                >
                  <td className="py-2.5 px-4 text-slate-300 font-medium">{row.month}</td>
                  <td className="py-2.5 px-4 text-yellow-400 font-bold">{row.predicted?.toFixed(1)}</td>
                  <td className="py-2.5 px-4 text-slate-400">{row.lower?.toFixed(1)}</td>
                  <td className="py-2.5 px-4 text-slate-400">{row.upper?.toFixed(1)}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs text-slate-500">
                      ± {((row.upper - row.lower) / 2).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model info */}
      <div className="card bg-slate-800/50">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">О модели</h3>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span>
            Метод: <span className="text-violet-400 font-medium">{method}</span>
            <span className="ml-1 text-slate-600">(Time Series Analysis)</span>
          </span>
          {aic != null && (
            <span>AIC: <span className="text-slate-300">{aic}</span></span>
          )}
          <span>MAE: <span className="text-slate-300">{mae}</span> инц./мес.</span>
          <span>
            Тренд:{' '}
            <span className={trend === 'decreasing' ? 'text-emerald-400' : 'text-red-400'}>
              {trend === 'decreasing' ? 'убывающий' : 'возрастающий'}
            </span>
          </span>
          <span className="text-slate-600">Доверительный интервал 95%</span>
        </div>
      </div>
    </div>
  )
}
