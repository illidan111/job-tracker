import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AuthGate } from './components/AuthGate'
const Auth = lazy(() => import('./pages/Auth'))

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Applications = lazy(() => import('./pages/Applications'))
const SavedJobs = lazy(() => import('./pages/SavedJobs'))
const Kanban = lazy(() => import('./pages/Kanban'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const ApplicationDetails = lazy(() => import('./pages/ApplicationDetails'))
const Journey = lazy(() => import('./pages/Journey'))
const Today = lazy(() => import('./pages/Today'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Companies = lazy(() => import('./pages/Companies'))
const Contacts = lazy(() => import('./pages/Contacts'))
const NotFound = lazy(() => import('./pages/NotFound'))

export function App() {
  return <BrowserRouter><Suspense fallback={<div className="app-loading" role="status"><span className="loading-spinner" />Getting your workspace ready…</div>}>
    <Routes><Route element={<AuthGate />}><Route path="login" element={<Auth />} /><Route path="signup" element={<Auth signup />} /><Route element={<AppLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="journey" element={<Journey />} />
      <Route path="today" element={<Today />} />
      <Route path="calendar" element={<Calendar />} />
      <Route path="tasks" element={<Tasks />} />
      <Route path="companies" element={<Companies />} />
      <Route path="companies/:id" element={<Companies />} />
      <Route path="contacts" element={<Contacts />} />
      <Route path="applications" element={<Applications />} />
      <Route path="saved" element={<SavedJobs />} />
      <Route path="applications/:id" element={<ApplicationDetails />} />
      <Route path="kanban" element={<Kanban />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<NotFound />} />
    </Route></Route></Routes>
  </Suspense></BrowserRouter>
}
