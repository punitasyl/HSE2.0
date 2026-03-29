import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { Search, Filter } from 'lucide-react'

const API = ''

const TYPE_COLORS: Record<string, string> = {
  'Несчастный случай': 'bg-red-500/20 text-red-400',
  'Микротравма':       'bg-yellow-500/20 text-yellow-400',
  'Инцидент':          'bg-blue-500/20 text-blue-400',
  'Пожар/Возгорание':  'bg-orange-500/20 text-orange-400',
  'ДТП':               'bg-purple-500/20 text-purple-400',
  'Ухудшение здоровья':'bg-slate-500/20 text-slate-400',
}

export default function IncidentStats() {
  const [summary, setSummary] = useState<any>(null)
  const [list, setList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 12

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/incidents/summary`).then((r) => r.json()),
      fetch(`${API}/api/incidents/list`).then((r) => r.json()),
    ])
      .then(([s, l]) => {
        setSummary(s)
        setList(l)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-sm animate-pulse">Загрузка...</div>
  if (!summary) return <div className="card text-red-400">Ошибка загрузки данных.</div>

  const types = ['all', ...Object.keys(summary.by_type || {})]

  const filtered = list.filter((row) => {
    const matchesType = typeFilter === 'all' || row.type === typeFilter
    const matchesSearch =
      !search ||
      Object.values(row).some((v) =>
        String(v ?? '').toLowerCase().includes(search.toLowerCase())
      )
    return matchesType && matchesSearch
  })

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-title">Динамика по месяцам</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={summary.by_month || []}>
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
                name="Происшествий"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="section-title">Топ локаций</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={(summary.by_location || []).slice(0, 8)}
              layout="vertical"
              margin={{ left: 0, right: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                dataKey="location"
                type="category"
                width={110}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + '…' : v)}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
              <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Происшествий" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по описанию, организации..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            />
          </div>
          <div className="relative">
            <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              className="bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 appearance-none"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}
            >
              {types.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'Все типы' : t}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-500 self-center">
            Показано {filtered.length} из {list.length}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Дата', 'Тип', 'Организация', 'Место', 'Тяжесть', 'Описание'].map((h) => (
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
              {paginated.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-2 px-3 text-slate-300 whitespace-nowrap text-xs">
                    {row['Дата возникновения происшествия'] || '—'}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        TYPE_COLORS[row.type] ?? 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300 text-xs max-w-[160px] truncate">
                    {row['Наименование организации ДЗО'] || '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-300 text-xs max-w-[120px] truncate">
                    {row['Место происшествия'] || '—'}
                  </td>
                  <td className="py-2 px-3 text-xs">
                    {row['Тяжесть травмы'] ? (
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          row['Тяжесть травмы'].includes('Летальный')
                            ? 'bg-red-500/20 text-red-400'
                            : row['Тяжесть травмы'].includes('тяжел')
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {row['Тяжесть травмы'].replace('Относится к ', '').replace('Не относится к ', 'Не ')}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-xs max-w-[200px] truncate">
                    {row['Краткое описание происшествия'] || '—'}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                    Нет данных по заданным критериям
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-600 transition-colors"
            >
              Назад
            </button>
            <span className="text-xs text-slate-500">
              Стр. {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-600 transition-colors"
            >
              Вперёд
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
