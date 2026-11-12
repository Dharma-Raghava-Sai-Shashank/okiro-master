import { useEffect } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import { api } from './lib/api'
import { useApp, useCoach } from './lib/store'
import { Shell } from './components/Shell'
import { Spinner } from './components/ui'
import { HomePage } from './routes/Home'
import { ContestsPage } from './routes/Contests'
import { WorkspacePage } from './routes/Workspace'
import { CalendarPage } from './routes/Calendar'
import { StatsPage } from './routes/Stats'
import { SettingsPage } from './routes/Settings'
import { Onboarding } from './routes/Onboarding'

const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/contests', element: <ContestsPage /> },
      { path: '/problem/:contestId/:index', element: <WorkspacePage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/stats', element: <StatsPage /> },
      { path: '/settings', element: <SettingsPage /> }
    ]
  }
])

export function App() {
  const settings = useApp((s) => s.settings)

  useEffect(() => {
    const app = useApp.getState()
    void app.loadSettings()
    void app.refreshUser()
    void app.refreshLlm()
    const offs = [
      api.on('coach:event', (e) => useCoach.getState().handle(e)),
      api.on('sync:done', (r) => {
        useApp.setState({ lastSync: r })
        useApp.getState().bump()
        void useApp.getState().refreshUser()
      }),
      api.on('submit:event', (e) => {
        if (e.phase === 'done') useApp.getState().bump()
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  if (!settings) {
    return (
      <div className="app-bg grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  if (!settings.onboarded) return <Onboarding />
  return <RouterProvider router={router} />
}
