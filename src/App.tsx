import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './sections/dashboard/Dashboard'

const Financial = lazy(() => import('./sections/financial/Financial').then((m) => ({ default: m.Financial })))
const Education = lazy(() => import('./sections/education/Education').then((m) => ({ default: m.Education })))
const Physical = lazy(() => import('./sections/physical/Physical').then((m) => ({ default: m.Physical })))
const Mental = lazy(() => import('./sections/mental/Mental').then((m) => ({ default: m.Mental })))
const Settings = lazy(() => import('./sections/settings/Settings').then((m) => ({ default: m.Settings })))

function Loading() {
  return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/financial"
            element={
              <Suspense fallback={<Loading />}>
                <Financial />
              </Suspense>
            }
          />
          <Route
            path="/education"
            element={
              <Suspense fallback={<Loading />}>
                <Education />
              </Suspense>
            }
          />
          <Route
            path="/physical"
            element={
              <Suspense fallback={<Loading />}>
                <Physical />
              </Suspense>
            }
          />
          <Route
            path="/mental"
            element={
              <Suspense fallback={<Loading />}>
                <Mental />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<Loading />}>
                <Settings />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}
