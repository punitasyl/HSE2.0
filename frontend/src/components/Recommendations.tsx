import React, { useState } from 'react'
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Building2,
  TrendingDown,
  AlertTriangle,
  Shield,
  Car,
  Flame,
  CheckCircle,
  Zap,
  Sparkles,
  RefreshCw,
  Clock,
  ListChecks,
} from 'lucide-react'

const API = ''

interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  affected_orgs: string[]
  expected_reduction: string
  timeline?: string
  steps?: string[]
  ai_generated?: boolean
  model?: string
}

const PRIORITY_CONFIG = {
  high: {
    label: 'Высокий',
    badge: 'badge-high',
    bg: 'border-orange-500/20',
    icon: <AlertTriangle size={16} />,
    iconColor: 'text-orange-400',
    barColor: 'bg-orange-500',
  },
  medium: {
    label: 'Средний',
    badge: 'badge-medium',
    bg: 'border-yellow-500/20',
    icon: <Zap size={16} />,
    iconColor: 'text-yellow-400',
    barColor: 'bg-yellow-500',
  },
  low: {
    label: 'Низкий',
    badge: 'badge-low',
    bg: 'border-emerald-500/20',
    icon: <CheckCircle size={16} />,
    iconColor: 'text-emerald-400',
    barColor: 'bg-emerald-500',
  },
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'СИЗ':                              <Shield size={20} />,
  'Управление рисками':               <AlertTriangle size={20} />,
  'Безопасность дорожного движения':  <Car size={20} />,
  'Пожарная безопасность':            <Flame size={20} />,
  'Устранение нарушений':             <CheckCircle size={20} />,
  'Культура безопасности':            <Building2 size={20} />,
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.medium

  return (
    <div className={`card border ${cfg.bg} transition-all`}>
      <div
        className="flex items-start justify-between gap-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 bg-slate-700/50 rounded-lg flex-shrink-0 ${cfg.iconColor}`}>
            {CATEGORY_ICON[rec.category] ?? <Lightbulb size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cfg.badge}>{cfg.label} приоритет</span>
              <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                {rec.category}
              </span>
              {rec.timeline && (
                <span className="text-xs bg-slate-700/70 text-slate-400 px-2 py-0.5 rounded flex items-center gap-1">
                  <Clock size={10} /> {rec.timeline}
                </span>
              )}
              {rec.ai_generated && (
                <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded flex items-center gap-1">
                  <Sparkles size={10} /> AI
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-200">{rec.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500">Ожид. снижение</p>
            <p className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              <TrendingDown size={14} />
              {rec.expected_reduction}
            </p>
          </div>
          <button className="text-slate-500 hover:text-slate-300 transition-colors">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
          <p className="text-sm text-slate-400 leading-relaxed">{rec.description}</p>

          {rec.affected_orgs && rec.affected_orgs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                <Building2 size={12} /> Затронутые организации
              </p>
              <div className="flex flex-wrap gap-2">
                {rec.affected_orgs.map((org, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-700/70 text-slate-300 px-2 py-1 rounded"
                  >
                    {org}
                  </span>
                ))}
              </div>
            </div>
          )}

          {rec.steps && rec.steps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                <ListChecks size={12} /> Шаги реализации
              </p>
              <ol className="space-y-1.5">
                {rec.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">Ожидаемое снижение инцидентов:</p>
            <p className="text-sm font-bold text-emerald-400">{rec.expected_reduction}</p>
          </div>

          <div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${cfg.barColor}`}
                style={{ width: rec.expected_reduction }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CACHE_KEY = 'hse_recommendations_cache'

type RecsData = {
  recommendations: Recommendation[]
  model?: string
  error?: string
  cached_at?: string
}

export default function Recommendations() {
  const [data, setData] = useState<RecsData | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      return raw ? (JSON.parse(raw) as RecsData) : null
    } catch {
      return null
    }
  })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const refresh = () => {
    setRefreshing(true)
    setRefreshError(null)
    fetch(`${API}/api/recommendations`)
      .then((r) => r.json())
      .then((d: RecsData) => {
        const withTs = { ...d, cached_at: new Date().toLocaleString('ru-RU') }
        setData(withTs)
        localStorage.setItem(CACHE_KEY, JSON.stringify(withTs))
      })
      .catch((e) => setRefreshError(String(e)))
      .finally(() => setRefreshing(false))
  }

  if (!data) {
    return (
      <div className="card text-center py-16">
        <Sparkles size={32} className="text-violet-400 mx-auto mb-3" />
        <p className="text-slate-300 font-medium mb-1">Рекомендации ещё не сгенерированы</p>
        <p className="text-xs text-slate-500 mb-4">Нажмите кнопку, чтобы запустить AI-анализ</p>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {refreshing
            ? <><RefreshCw size={14} className="animate-spin" /> Генерация...</>
            : <><Sparkles size={14} /> Сгенерировать</>}
        </button>
        {refreshError && <p className="text-xs text-red-400 mt-3">{refreshError}</p>}
      </div>
    )
  }

  const recs = data.recommendations || []
  const high = recs.filter((r) => r.priority === 'high').length
  const medium = recs.filter((r) => r.priority === 'medium').length

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card flex items-start gap-3">
          <div className="p-2.5 bg-orange-500/10 rounded-lg">
            <AlertTriangle size={18} className="text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Высокий приоритет</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{high}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="p-2.5 bg-yellow-500/10 rounded-lg">
            <Zap size={18} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Средний приоритет</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{medium}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-lg">
            <Lightbulb size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Всего рекомендаций</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{recs.length}</p>
          </div>
        </div>
      </div>

      {/* AI banner */}
      <div className="card bg-violet-500/5 border-violet-500/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-500/10 rounded-lg flex-shrink-0">
              <Sparkles size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Рекомендации сгенерированы{' '}
                {data.model && <span className="text-violet-300">{data.model}</span>}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                На основе анализа инцидентов и нарушений Коргау. Используется OpenAI API или Ollama Llama 3.2.
              </p>
              {data.error && (
                <p className="text-xs text-red-400 mt-1">{data.error}</p>
              )}
            </div>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors flex-shrink-0"
          >
            <RefreshCw size={13} /> Обновить
          </button>
        </div>
      </div>

      {/* Recommendations list */}
      {recs.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Нет активных рекомендаций</p>
          <p className="text-xs text-slate-500 mt-1">Показатели безопасности в норме</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recs.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} />
          ))}
        </div>
      )}
    </div>
  )
}
