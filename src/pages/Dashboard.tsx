import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react'

import { useJourney } from '../hooks/useJourney'
import { useWorkspace } from '../state/useWorkspace'
import { useOverview } from '../hooks/useOverview'
import { RemoteState } from '../components/ui/RemoteState'
import { useUI } from '../state/useUI'
import { Button } from '../components/ui/Button'
import { RecentActivity } from '../components/RecentActivity'
import { JourneyProgress, QuestList } from '../components/JourneyProgress'

export default function Dashboard() {
  const query = useOverview()
  const journey = useJourney()
  const name = useWorkspace(state => state.profile.name.split(' ')[0])
  const openEditor = useUI(state => state.openEditor)
  if (!query.data) return <><h1>Your next chapter</h1><RemoteState {...query} /></>
  const { metrics, currentStatuses, savedCount, activity } = query.data
  const steps = journey.data?.quests.filter(step => !step.completed).slice(0, 3) ?? []
  const hour = new Date().getHours()
  return <div className="home-page">
    <header className="home-heading"><p className="eyebrow">Your career, in motion</p><h1>Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, {name}.</h1><p>{!metrics.total ? 'A new chapter starts with one opportunity.' : !journey.data ? 'Your opportunities, and the steps ahead.' : steps.length ? `${steps.length === 1 ? 'One useful step' : `${steps.length} useful steps`} to move things forward.` : 'Room to breathe. Your next move is yours.'}</p></header>
    <div className="home-focus"><section className="home-priorities"><div className="section-heading"><h2>{metrics.total ? 'Make your next move' : 'Find your starting point'}</h2><Link className="text-link" to="/today">Your day <ArrowUpRight size={15} /></Link></div><RemoteState {...journey} />{journey.data && (steps.length ? <QuestList steps={steps} /> : <div className="starting-point"><span className="route-symbol" aria-hidden="true">↗</span><div><h3>{metrics.total ? 'Nothing urgent on your path.' : 'Keep a possibility close.'}</h3><p>{metrics.total ? 'Choose a task, explore a role, or take a pause.' : 'Save a role that interests you. Come back when you’re ready.'}</p><Link className="text-link" to={metrics.total ? '/tasks' : '/saved'}>{metrics.total ? 'Choose your next step' : 'Save an opportunity'} <ArrowRight size={16} /></Link></div></div>)}<Button variant="secondary" onClick={() => openEditor()}><Plus size={16} />Add application</Button></section><JourneyProgress /></div>
    <section className="pipeline-route" aria-label="Your pipeline"><div className="section-heading"><div><p className="eyebrow">The bigger picture</p><h2>Possibilities becoming progress.</h2></div><Link to="/kanban" className="text-link">Open board <ArrowUpRight size={15} /></Link></div><div className="route-stations">{[{ label: 'Saved', count: savedCount, to: '/saved' }, { label: 'Applied', count: currentStatuses.APPLIED, to: '/applications?status=APPLIED' }, { label: 'In conversation', count: currentStatuses.SCREENING + currentStatuses.INTERVIEW, to: '/kanban' }, { label: 'Offers', count: currentStatuses.OFFER, to: '/applications?status=OFFER' }].map((item, i) => <Link key={item.label} to={item.to}><span className="station-dot" /><small>0{i + 1}</small><strong>{item.count}</strong><span>{item.label}</span></Link>)}</div></section>
    <div className="home-lower"><section><div className="section-heading"><h2>Along the way</h2><Link className="text-link" to="/applications">Applications <ArrowRight size={15} /></Link></div>{activity.length ? <RecentActivity items={activity} /> : <p className="quiet-empty">Your first step will appear here. No rush.</p>}</section><section className="search-pulse"><p className="eyebrow">A little perspective</p><strong>{metrics.active}<span>active {metrics.active === 1 ? 'opportunity' : 'opportunities'}</span></strong><p>{metrics.thisWeek} applications sent this week.</p><Link to="/analytics" className="text-link">See what’s working <ArrowUpRight size={15} /></Link></section></div>
  </div>
}
