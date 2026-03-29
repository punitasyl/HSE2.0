import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle,
  RefreshCw,
  Bell,
} from 'lucide-react'

const API = ''

interface Alert {
  level: 'critical' | 'high' | 'medium' | 'low'
  org: string
  category: string
  message: string
  count: number
  threshold: number
  period: string
}

const LEVEL_CONFIG = {
  critical: {
    label: 'Критический',
    icon: <AlertOctagon size={18} />,
    bg: 'bg-red-500/10 border-red-500/30',
    badge: 'badge-critical',
    text: 'text-red-400',
    dot: 'bg-red-500',
  },
  high: {
    label: 'Высокий',
    icon: <AlertTriangle size={18} />,
    bg: 'bg-orange-500/10 border-orange-500/30',
    badge: 'badge-high',
    text: 'text-orange-400',
    dot: 'bg-orange-500',
  },
  medium: {
    label: 'Средний',
    icon: <Info size={18} />,
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    badge: 'badge-medium',
    text: 'text-yellow-400',
    dot: 'bg-yellow-500',
  },
  low: {
    label: 'Улучшение',
    icon: <CheckCircle size={18} />,
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    badge: 'badge-low',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
  },
}

export default function AlertsPanel() {
  const [data, setData] = useState<{ alerts: Alert[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')

  const loadData = () => {
    setLoading(true)
    fetch(`${API}/api/alerts`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  if (loading) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>
  if (!data) return <div className="card text-red-400">Ошибка загрузки данных.</div>

  const alerts = data.alerts || []

  const counts = {
    critical: alerts.filter((a) => a.level === 'critical').length,
    high:     alerts.filter((a) => a.level === 'high').length,
    medium:   alerts.filter((a) => a.level === 'medium').length,
    low:      alerts.filter((a) => a.level === 'low').length,
  }

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.level === filter)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
          const cfg = LEVEL_CONFIG[level]
          return (
            <button
              key={level}
              onClick={() => setFilter(filter === level ? 'all' : level)}
              className={`card text-left transition-all ${
                filter === level ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cfg.text}>{cfg.icon}</span>
                <span className={cfg.badge}>{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{counts[level]}</p>
              <p className="text-xs text-slate-500 mt-0.5">алертов</p>
            </button>
          )
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-200">
            {filter === 'all' ? `Все алерты (${alerts.length})` : `${LEVEL_CONFIG[filter].label} (${counts[filter]})`}
          </h2>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>

      {/* Alert cards */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Нет алертов в данной категории</p>
          <p className="text-xs text-slate-500 mt-1">Показатели безопасности в норме</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert, i) => {
            const cfg = LEVEL_CONFIG[alert.level]
            const pct = Math.min(100, Math.round((alert.count / (alert.threshold * 3)) * 100))
            return (
              <div
                key={i}
                className={`border rounded-xl p-4 ${cfg.bg}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`flex-shrink-0 mt-0.5 ${cfg.text}`}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cfg.badge}>{cfg.label}</span>
                        <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                          {alert.category}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">{alert.org}</p>
                      <p className="text-xs text-slate-400 mt-1">{alert.message}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-bold ${cfg.text}`}>{alert.count}</p>
                    <p className="text-xs text-slate-500">нарушений</p>
                  </div>
                </div>

                {/* Progress bar vs threshold */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Нарушений: {alert.count}</span>
                    <span>Порог: {alert.threshold}</span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        alert.level === 'critical' ? 'bg-red-500' :
                        alert.level === 'high' ? 'bg-orange-500' :
                        alert.level === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-600">
                  Период: {alert.period === 'last_30_days' ? 'последние 30 дней' : alert.period}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
