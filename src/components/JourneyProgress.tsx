import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronRight } from 'lucide-react'
import { useJourney } from '../hooks/useJourney'
import { Companion } from './Companion'
import type { JourneyStep } from '../domain/journey'

export function JourneyProgress() {
  const { data } = useJourney()
  if (!data || !data.enabled) return null
  return <Link to="/journey" className="home-journey" aria-label={`Your journey, level ${data.progress.level}, ${data.xp} XP`}><Companion xp={data.xp} kind={data.companion} stage={data.progress.stage} /><div><span className="eyebrow">Your journey <ArrowUpRight size={14} /></span><strong>Level {data.progress.level} <span>{data.progress.title}</span></strong><progress aria-label="Progress to next level" value={data.progress.current} max={data.progress.required} /><small>{data.progress.next - data.xp} XP to your next waypoint</small></div></Link>
}
export function QuestList({ steps }: { steps: JourneyStep[] }) {
  return <ol className="quest-list">{steps.map((step, index) => <li key={step.id}><Link to={step.href} className={step.completed ? 'quest-complete' : ''}><span className="quest-marker">{step.completed ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</span><span><small>{step.kind}{step.due ? ` · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(step.due + 'T12:00:00Z'))}` : ''}</small><strong>{step.title}</strong><p>{step.detail}</p></span><ChevronRight size={18} /></Link></li>)}</ol>
}
