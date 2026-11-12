import { NavLink, Outlet, useLocation } from 'react-router'
import { BarChart3, CalendarDays, Home, LayoutGrid, RefreshCw, Settings as Cog } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../lib/store'
import { api } from '../lib/api'
import { cx, ratingColor, timeAgo } from '../lib/format'
import { Flame } from './ui'

const NAV = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/contests', icon: LayoutGrid, label: 'Contests' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/stats', icon: BarChart3, label: 'Stats' },
  { to: '/settings', icon: Cog, label: 'Settings' }
]

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/contests': 'Contests',
  '/calendar': 'Calendar',
  '/stats': 'Stats',
  '/settings': 'Settings'
}

export function Shell() {
  const { user, syncing, lastSync, sync, settings, dataVersion } = useApp()
  const loc = useLocation()
  const [streak, setStreak] = useState(0)
  useEffect(() => {
    void api.stats.summary().then((s) => setStreak(s.streak))
  }, [dataVersion])
  const title = TITLES[loc.pathname] ?? (loc.pathname.startsWith('/problem') ? 'Workspace' : '')
  return (
    <div className="app-bg flex h-full">
      <aside className="drag flex w-[72px] shrink-0 flex-col items-center gap-2 border-r border-white/[0.05] pb-4 pt-12">
        <div className="no-drag mb-4 grid size-10 place-items-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
          <Flame className="size-6" />
        </div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={({ isActive }) =>
              cx(
                'no-drag grid size-11 place-items-center rounded-2xl transition',
                isActive ? 'accent-grad accent-glow text-white' : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200'
              )
            }
          >
            <Icon className="size-[19px]" strokeWidth={2.2} />
          </NavLink>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="drag flex h-14 shrink-0 items-center gap-3 px-6">
          <h1 className="text-[15px] font-extrabold tracking-tight text-slate-100">{title}</h1>
          <div className="flex-1" />
          <button
            className="no-drag flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
            onClick={() => void sync(true)}
            title="Refresh contests, problems and your submissions from Codeforces"
          >
            <RefreshCw className={cx('size-3.5', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : lastSync ? (lastSync.error ? 'Sync failed' : `Synced ${timeAgo(lastSync.at)}`) : 'Sync'}
          </button>
          {streak > 0 && (
            <div className="no-drag flex items-center gap-1 rounded-xl border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-200">
              <Flame className="size-4" /> {streak}
            </div>
          )}
          {settings?.handle && (
            <div className="no-drag flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-2.5 py-1">
              {user?.avatar && <img src={user.avatar} className="size-5 rounded-full" alt="" />}
              <span className="text-xs font-bold" style={{ color: ratingColor(user?.rating) }}>
                {settings.handle}
              </span>
              {user?.rating != null && <span className="text-xs tabular-nums text-slate-400">{user.rating}</span>}
            </div>
          )}
        </header>
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
