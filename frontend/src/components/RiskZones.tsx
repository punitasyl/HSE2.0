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
import { MapPin, Building2, AlertTriangle, TrendingUp } from 'lucide-react'

const API = ''

function getRiskColor(score: number): string {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f97316'
  if (score >= 20) return '#f59e0b'
  return '#10b981'
}

function RiskBadge({ score }: { score: number }) {
  const label = score >= 70 ? 'Критический' : score >= 40 ? 'Высокий' : score >= 20 ? 'Средний' : 'Низкий'
  const cls =
    score >= 70 ? 'badge-critical' :
    score >= 40 ? 'badge-high' :
    score >= 20 ? 'badge-medium' : 'badge-low'
  return <span className={cls}>{label}</span>
}

export default function RiskZones() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/risk-zones`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>
  if (!data) return <div className="card text-red-400">Ошибка загрузки данных.</div>

  const topOrgs = data.top_orgs || []
  const topLocations = data.top_locations || []

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card flex items-start gap-3">
          <div className="p-3 bg-red-500/10 rounded-lg">
            <Building2 size={20} className="text-red-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Критических орг.</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {topOrgs.filter((o: any) => o.risk_score >= 70).length}
            </p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="p-3 bg-orange-500/10 rounded-lg">
            <AlertTriangle size={20} className="text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Высокий риск</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {topOrgs.filter((o: any) => o.risk_score >= 40 && o.risk_score < 70).length}
            </p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <MapPin size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Локаций с риском</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {topLocations.filter((l: any) => l.risk_score >= 30).length}
            </p>
          </div>
        </div>
      </div>

      {/* Orgs charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-title flex items-center gap-2">
            <Building2 size={18} /> Риск-рейтинг организаций
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topOrgs}
              layout="vertical"
              margin={{ left: 0, right: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                dataKey="org"
                type="category"
                width={130}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 20) + '…' : v)}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: any) => [`${v?.toFixed(1)}`, 'Индекс риска']}
              />
              <Bar dataKey="risk_score" radius={[0, 4, 4, 0]} name="Индекс риска">
                {topOrgs.map((entry: any, i: number) => (
                  <Cell key={i} fill={getRiskColor(entry.risk_score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="section-title flex items-center gap-2">
            <MapPin size={18} /> Риск-рейтинг локаций
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topLocations}
              layout="vertical"
              margin={{ left: 0, right: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                dataKey="location"
                type="category"
                width={110}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + '…' : v)}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: any) => [`${v?.toFixed(1)}`, 'Индекс риска']}
              />
              <Bar dataKey="risk_score" radius={[0, 4, 4, 0]} name="Индекс риска">
                {topLocations.map((entry: any, i: number) => (
                  <Cell key={i} fill={getRiskColor(entry.risk_score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed table */}
      <div className="card">
        <h2 className="section-title">Детальная таблица организаций</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['#', 'Организация', 'Происшествий', 'Несч. случаев', 'Нарушений', 'Тренд', 'Индекс риска', 'Уровень'].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topOrgs.map((row: any, i: number) => (
                <tr
                  key={i}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-2.5 px-3 text-slate-500 text-xs">{i + 1}</td>
                  <td className="py-2.5 px-3 text-slate-200 text-xs max-w-[200px] truncate">
                    {row.org}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-sm font-bold text-red-400">{row.incident_count}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-sm font-semibold text-rose-300">{row.accidents ?? 0}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-sm font-semibold text-orange-400">{row.violations}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.trend_growing
                      ? <TrendingUp size={14} className="text-red-400 mx-auto" />
                      : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${row.risk_score}%`,
                            background: getRiskColor(row.risk_score),
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-bold"
                        style={{ color: getRiskColor(row.risk_score) }}
                      >
                        {row.risk_score?.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <RiskBadge score={row.risk_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formula note */}
      <div className="card bg-slate-800/40 border-slate-700/50">
        <p className="text-xs text-slate-500">
          <span className="text-slate-400 font-medium">Методика расчёта (Risk Scoring):</span>{' '}
          Индекс = (Происшествий × 10 + Несч. случаев × 30 + Нарушений × 2 + Тренд роста +15 − Устранение &gt;80% −10) / макс × 100.
          Учитывает тяжесть инцидентов, динамику роста и культуру устранения нарушений.
        </p>
      </div>
    </div>
  )
}
