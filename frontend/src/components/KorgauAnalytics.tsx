import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { CheckCircle, XCircle, AlertOctagon, TrendingUp } from 'lucide-react'

const API = ''

const TYPE_COLORS: Record<string, string> = {
  'Опасный фактор':           '#ef4444',
  'Небезопасное условие':     '#f97316',
  'Небезопасное условие ':    '#f97316',
  'Небезопасное поведение':   '#f59e0b',
  'Небезопасное действие':    '#eab308',
  'Опасный случай':           '#dc2626',
  'Хорошая практика':         '#10b981',
  'Предложение (инициатива)': '#3b82f6',
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function KorgauAnalytics() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/korgau/summary`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>
  if (!data) return <div className="card text-red-400">Ошибка загрузки данных.</div>

  const byType = data.by_type || {}
  const violationTypes = ['Опасный фактор', 'Небезопасное условие', 'Небезопасное условие ', 'Небезопасное поведение', 'Небезопасное действие', 'Опасный случай']
  const totalViolations = violationTypes.reduce((s, k) => s + (byType[k] || 0), 0)
  const goodPractice = byType['Хорошая практика'] || 0
  const resolutionPct = ((data.resolution_rate || 0) * 100).toFixed(1)

  const pieData = Object.entries(byType).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Всего карточек"
          value={data.total?.toLocaleString()}
          sub="за весь период"
          icon={<AlertOctagon size={20} className="text-blue-400" />}
          color="bg-blue-500/10"
        />
        <StatCard
          label="Нарушений"
          value={totalViolations.toLocaleString()}
          sub="опасные факторы + поведение"
          icon={<XCircle size={20} className="text-red-400" />}
          color="bg-red-500/10"
        />
        <StatCard
          label="Хорошая практика"
          value={goodPractice.toLocaleString()}
          sub="положительных наблюдений"
          icon={<CheckCircle size={20} className="text-emerald-400" />}
          color="bg-emerald-500/10"
        />
        <StatCard
          label="Устранено"
          value={`${resolutionPct}%`}
          sub="нарушений закрыто"
          icon={<TrendingUp size={20} className="text-yellow-400" />}
          color="bg-yellow-500/10"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        <div className="card lg:col-span-2">
          <h2 className="section-title">Динамика карточек по месяцам</h2>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={data.by_month || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: string) => v?.slice(2)}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Карточек"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie by type */}
        <div className="card">
          <h2 className="section-title">По типу наблюдений</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={TYPE_COLORS[(entry as any).name] ?? PIE_COLORS[i % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-1 space-y-1.5 max-h-32 overflow-y-auto">
            {pieData.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{
                      background:
                        TYPE_COLORS[(entry as any).name] ?? PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                  {(entry as any).name}
                </span>
                <span className="font-medium text-slate-200">{String((entry as any).value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categories + Orgs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top categories */}
        <div className="card">
          <h2 className="section-title">Топ категорий нарушений</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(data.by_category || []).slice(0, 15).map((cat: any, i: number) => {
              const max = data.by_category[0]?.count || 1
              const pct = Math.round((cat.count / max) * 100)
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 truncate max-w-[75%]">{cat.category}</span>
                    <span className="text-slate-400 font-medium">{cat.count}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top orgs */}
        <div className="card">
          <h2 className="section-title">Топ организаций</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={(data.by_org || []).slice(0, 10)}
              layout="vertical"
              margin={{ left: 0, right: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                dataKey="org"
                type="category"
                width={120}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + '…' : v)}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Карточек" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resolution rate bar */}
      <div className="card">
        <h2 className="section-title">Показатель устранения нарушений</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Устранено</span>
              <span className="text-emerald-400 font-semibold">{resolutionPct}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4">
              <div
                className="bg-emerald-500 h-4 rounded-full transition-all"
                style={{ width: `${resolutionPct}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Цель</p>
            <p className="text-sm font-bold text-slate-300">90%</p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Устранено</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-700" /> Не устранено</span>
        </div>
      </div>
    </div>
  )
}
