import React, { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Flame,
  Car,
} from 'lucide-react'

const API = ''

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

type Page = string

interface Props {
  onNavigate: (page: Page) => void
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
  trend,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
        {sub && (
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            {trend === 'down' && <TrendingDown size={12} className="text-emerald-400" />}
            {trend === 'up' && <TrendingUp size={12} className="text-red-400" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

export default function Dashboard({ onNavigate }: Props) {
  const [summary, setSummary] = useState<any>(null)
  const [koргau, setKoргau] = useState<any>(null)
  const [predictions, setPredictions] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/incidents/summary`).then((r) => r.json()),
      fetch(`${API}/api/korgau/summary`).then((r) => r.json()),
      fetch(`${API}/api/predictions`).then((r) => r.json()),
    ])
      .then(([s, k, p]) => {
        setSummary(s)
        setKoргau(k)
        setPredictions(p)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm animate-pulse">Загрузка данных...</div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="card text-red-400">
        Не удалось загрузить данные. Убедитесь, что backend запущен на порту 8000.
      </div>
    )
  }

  const byType = summary.by_type || {}
  const accidents = byType['Несчастный случай'] || 0
  const microtraumas = byType['Микротравма'] || 0
  const fires = byType['Пожар/Возгорание'] || 0
  const dtp = byType['ДТП'] || 0

  const pieData = Object.entries(byType).map(([name, value]) => ({ name, value }))

  // Combine historical + forecast for trend chart
  const trendData = [
    ...(predictions?.historical || []).map((h: any) => ({
      month: h.month,
      actual: h.actual,
      predicted: null,
    })),
    ...(predictions?.forecast?.slice(0, 6) || []).map((f: any) => ({
      month: f.month,
      actual: null,
      predicted: f.predicted,
    })),
  ]

  const trend = predictions?.model_metrics?.trend

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Всего происшествий"
          value={summary.total}
          sub={trend === 'decreasing' ? 'Тренд снижения' : 'Тренд роста'}
          trend={trend === 'decreasing' ? 'down' : 'up'}
          icon={<Activity size={20} className="text-blue-400" />}
          color="bg-blue-500/10"
        />
        <KpiCard
          label="Несчастных случаев"
          value={accidents}
          sub="Требуют расследования"
          icon={<AlertTriangle size={20} className="text-red-400" />}
          color="bg-red-500/10"
        />
        <KpiCard
          label="Карточки Коргау"
          value={koргau?.total?.toLocaleString() ?? '—'}
          sub={`Устранено ${((koргau?.resolution_rate ?? 0) * 100).toFixed(0)}%`}
          trend="down"
          icon={<Shield size={20} className="text-emerald-400" />}
          color="bg-emerald-500/10"
        />
        <KpiCard
          label="Микротравмы"
          value={microtraumas}
          sub="Медицинская помощь"
          icon={<Users size={20} className="text-yellow-400" />}
          color="bg-yellow-500/10"
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Пожары / Возгорания"
          value={fires}
          icon={<Flame size={20} className="text-orange-400" />}
          color="bg-orange-500/10"
        />
        <KpiCard
          label="ДТП"
          value={dtp}
          icon={<Car size={20} className="text-purple-400" />}
          color="bg-purple-500/10"
        />
        <KpiCard
          label="Организаций"
          value={summary.by_org?.length ?? '—'}
          sub="с происшествиями"
          icon={<Users size={20} className="text-cyan-400" />}
          color="bg-cyan-500/10"
        />
        <KpiCard
          label="Прогноз (след. мес.)"
          value={predictions?.forecast?.[0]?.predicted?.toFixed(0) ?? '—'}
          sub="происшествий"
          icon={<TrendingUp size={20} className="text-indigo-400" />}
          color="bg-indigo-500/10"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        <div className="card lg:col-span-2">
          <h2 className="section-title">Динамика происшествий по месяцам</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => v?.slice(2)}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Факт"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                name="Прогноз"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie by type */}
        <div className="card">
          <h2 className="section-title">Типы происшествий</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {pieData.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {entry.name}
                </span>
                <span className="font-medium text-slate-200">{String(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top orgs */}
        <div className="card">
          <h2 className="section-title">Топ организаций по происшествиям</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={(summary.by_org || []).slice(0, 8)}
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
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Происшествий" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By business unit */}
        <div className="card">
          <h2 className="section-title">По бизнес-направлениям</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.by_business || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="unit"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + '…' : v)}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Происшествий" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Алерты',       page: 'alerts',          color: 'text-red-400 border-red-500/30 hover:bg-red-500/10' },
          { label: 'Прогноз',      page: 'predictions',     color: 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10' },
          { label: 'Сценарии',     page: 'scenarios',       color: 'text-violet-400 border-violet-500/30 hover:bg-violet-500/10' },
          { label: 'Рекомендации', page: 'recommendations', color: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10' },
        ].map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page as Page)}
            className={`card-sm text-sm font-medium border transition-colors ${item.color}`}
          >
            {item.label} →
          </button>
        ))}
      </div>
    </div>
  )
}
