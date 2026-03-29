import React, { useState } from 'react'
import {
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Bell,
  MapPin,
  Lightbulb,
  DollarSign,
  Shield,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import Dashboard from './components/Dashboard'
import IncidentStats from './components/IncidentStats'
import KorgauAnalytics from './components/KorgauAnalytics'
import Predictions from './components/Predictions'
import AlertsPanel from './components/AlertsPanel'
import RiskZones from './components/RiskZones'
import Recommendations from './components/Recommendations'
import EconomicEffect from './components/EconomicEffect'
import Scenarios from './components/Scenarios'

type Page =
  | 'dashboard'
  | 'incidents'
  | 'korgau'
  | 'predictions'
  | 'alerts'
  | 'risk-zones'
  | 'recommendations'
  | 'economic'
  | 'scenarios'

interface NavItem {
  id: Page
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { id: 'dashboard',       label: 'Обзор',              icon: <LayoutDashboard size={20} /> },
  { id: 'incidents',       label: 'Происшествия',        icon: <AlertTriangle size={20} /> },
  { id: 'korgau',          label: 'Карта Коргау',        icon: <Shield size={20} /> },
  { id: 'predictions',     label: 'Прогноз',             icon: <TrendingUp size={20} /> },
  { id: 'alerts',          label: 'Алерты',              icon: <Bell size={20} /> },
  { id: 'risk-zones',      label: 'Зоны риска',          icon: <MapPin size={20} /> },
  { id: 'recommendations', label: 'Рекомендации',        icon: <Lightbulb size={20} /> },
  { id: 'scenarios',       label: 'Сценарии',            icon: <FlaskConical size={20} /> },
  { id: 'economic',        label: 'Экономический эффект', icon: <DollarSign size={20} /> },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [collapsed, setCollapsed] = useState(false)

  const renderPage = () => {
    switch (page) {
      case 'dashboard':       return <Dashboard onNavigate={setPage} />
      case 'incidents':       return <IncidentStats />
      case 'korgau':          return <KorgauAnalytics />
      case 'predictions':     return <Predictions />
      case 'alerts':          return <AlertsPanel />
      case 'risk-zones':      return <RiskZones />
      case 'recommendations': return <Recommendations />
      case 'scenarios':       return <Scenarios />
      case 'economic':        return <EconomicEffect />
      default:                return <Dashboard onNavigate={setPage} />
    }
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-slate-900 border-r border-slate-700/50 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50 min-h-[68px]">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-slate-100 leading-none">HSE Analytics</p>
              <p className="text-xs text-slate-400 mt-0.5">AI Platform</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                page === item.id
                  ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-slate-700/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">
            {navItems.find((n) => n.id === page)?.label ?? 'HSE Analytics'}
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Данные актуальны
          </div>
        </header>

        <div className="p-6">{renderPage()}</div>
      </main>
    </div>
  )
}
