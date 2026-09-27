import type { Application, Profile, Status } from '../types/application'
import { daysAgo } from '../utils/dates'

export const defaultProfile: Profile = {
  name: 'Alex Morgan', email: '', headline: 'Finding the next great opportunity',
  weeklyGoal: 8, appearance: 'light', interviewReminders: true,
}

export function createDemoApplications(): Application[] {
  const rows: [string, string, string, number, Status, number, string[]][] = [
    ['Linear', 'Senior Frontend Engineer', 'Remote', 165000, 'INTERVIEW', 3, ['React', 'Product']],
    ['Notion', 'Product Engineer', 'San Francisco, CA', 175000, 'SCREENING', 2, ['TypeScript', 'SaaS']],
    ['Vercel', 'Frontend Engineer', 'Remote', 155000, 'APPLIED', 0, ['Next.js', 'Developer tools']],
    ['Figma', 'Design Engineer', 'New York, NY', 180000, 'INTERVIEW', 6, ['Design systems', 'React']],
    ['Kaspi.kz', 'Frontend Developer', 'Astana', 68000, 'INTERVIEW', 8, ['Fintech', 'TypeScript']],
    ['Stripe', 'Frontend Engineer, Payments', 'Remote', 170000, 'APPLIED', 1, ['Fintech', 'React']],
    ['Webflow', 'Senior UI Engineer', 'Remote', 160000, 'OFFER', 19, ['Web platform', 'Design systems']],
    ['Miro', 'Product Engineer', 'Amsterdam', 115000, 'SCREENING', 5, ['Collaboration', 'React']],
    ['Spotify', 'Web Engineer', 'London', 125000, 'REJECTED', 24, ['Consumer', 'Web platform']],
    ['Air Astana', 'Frontend Developer', 'Astana', 52000, 'APPLIED', 4, ['Travel', 'Vue']],
    ['Canva', 'Frontend Software Engineer', 'Sydney', 140000, 'APPLIED', 10, ['Creative tools', 'TypeScript']],
    ['Atlassian', 'Senior Software Engineer', 'Remote', 165000, 'REJECTED', 32, ['SaaS', 'React']],
    ['GitLab', 'Frontend Engineer', 'Remote', 145000, 'SCREENING', 13, ['Open source', 'Vue']],
    ['Intercom', 'Product Engineer', 'Dublin', 120000, 'APPLIED', 17, ['Customer experience', 'React']],
    ['Wise', 'Web Engineer', 'London', 130000, 'REJECTED', 37, ['Fintech', 'TypeScript']],
    ['Superhuman', 'Frontend Engineer', 'Remote', 155000, 'APPLIED', 22, ['Productivity', 'React']],
    ['Kolesa Group', 'Frontend Engineer', 'Almaty', 60000, 'SCREENING', 9, ['Marketplace', 'Vue']],
    ['Framer', 'Design Engineer', 'Amsterdam', 110000, 'OFFER', 41, ['Design', 'React']],
    ['Shopify', 'Frontend Developer', 'Remote', 150000, 'APPLIED', 29, ['Commerce', 'React']],
    ['Dropbox', 'Web Engineer', 'Remote', 158000, 'REJECTED', 49, ['Collaboration', 'TypeScript']],
    ['Bolt', 'Frontend Engineer', 'Tallinn', 95000, 'APPLIED', 35, ['Mobility', 'React']],
    ['Headspace', 'UI Engineer', 'Remote', 135000, 'APPLIED', 44, ['Wellness', 'Accessibility']],
    ['Duolingo', 'Frontend Engineer', 'New York, NY', 165000, 'REJECTED', 53, ['Education', 'React']],
    ['Buffer', 'Product Engineer', 'Remote', 130000, 'APPLIED', 57, ['Social', 'TypeScript']],
  ]
  return rows.map(([company, position, location, salary, status, days, tags], index) => {
    const createdAt = `${daysAgo(days)}T09:00:00.000Z`
    const updatedAt = `${daysAgo(Math.max(0, days - (status === 'OFFER' ? 7 : 2)))}T10:30:00.000Z`
    const interview = new Date()
    interview.setDate(interview.getDate() + (index === 0 ? 1 : index === 3 ? 2 : 4))
    interview.setHours(index === 0 ? 10 : 14, 30, 0, 0)
    const id = `demo-${index + 1}`
    const recruiter = ['Jamie Chen', 'Sarah Wilson', 'Aigerim Nur'][index === 0 ? 0 : index === 3 ? 1 : 2]
    const contacts: Application['contacts'] = status === 'INTERVIEW' ? [{ id: `${id}-contact`, name: recruiter, email: `recruiter${index + 1}@example.test`, company, role: 'Talent partner', linkedInUrl: '', notes: 'Ask about team priorities and the next steps in the process.', version: 1, createdAt, updatedAt }] : []
    const interviews: Application['interviews'] = status === 'INTERVIEW' ? [
      ...(index === 0 ? [{ id: `${id}-screen`, scheduledAt: updatedAt, type: 'Phone' as const, interviewer: recruiter, meetingUrl: '', notes: 'Discussed product ownership and team structure. Moving on to the technical conversation.', outcome: 'Next round' as const, round: 'Recruiter screen', location: '', createdAt, updatedAt }] : []),
      { id: `${id}-interview`, scheduledAt: interview.toISOString(), type: index === 0 ? 'Technical' : index === 3 ? 'Behavioral' : 'Video', interviewer: recruiter, meetingUrl: 'https://meet.example.test/waypoint-demo', notes: 'Prepare recent projects and questions for the team.', outcome: 'Scheduled', round: 'Next round', location: '', createdAt, updatedAt },
    ] : []
    return {
      id, company, position, location, salary, status, dateApplied: daysAgo(days),
      version: 1, workMode: location === 'Remote' ? 'Remote' : 'Hybrid', source: index % 3 === 0 ? 'Referral' : index % 3 === 1 ? 'LinkedIn' : 'Company website', deadline: '', archivedAt: '',
      followUpReason: index === 1 ? 'Check application status' : index === 5 ? 'Follow up with recruiter' : '', followUpNote: '',
      followUpDate: index === 1 ? daysAgo(-1) : index === 5 ? daysAgo(0) : '', followUpCompletedAt: '', contacts, interviews,
      employmentType: index === 9 || index === 21 ? 'Contract' : 'Full-time',
      jobUrl: `https://${company === 'Kaspi.kz' ? 'kaspi.kz' : company.toLowerCase().replace(/[^a-z]/g, '') + '.com'}`,
      recruiter: status === 'INTERVIEW' ? recruiter : '',
      recruiterEmail: contacts[0]?.email ?? '', interviewDate: status === 'INTERVIEW' ? interview.toISOString() : '',
      notes: status === 'INTERVIEW'
        ? 'Prepare two recent projects that show product thinking and technical ownership. Review the team’s work and bring questions about the engineering culture.'
        : status === 'OFFER' ? 'Offer received. Review compensation, team expectations, and growth opportunities before making a decision.' : `Interested in ${company}’s product and engineering culture. Applied with a tailored resume and portfolio.`,
      tags, createdAt, updatedAt,
      timeline: [
        { id: `${id}-created`, type: 'created', at: createdAt, status: 'APPLIED' },
        ...(status === 'OFFER' ? [{ id: `${id}-interview`, type: 'status' as const, at: `${daysAgo(days - 4)}T09:00:00.000Z`, status: 'INTERVIEW' as const }] : []),
        ...(status !== 'APPLIED' ? [{ id: `${id}-status`, type: 'status' as const, at: status === 'OFFER' ? `${daysAgo(days - 7)}T10:30:00.000Z` : updatedAt, status }] : []),
        ...(status === 'INTERVIEW' ? [{ id: `${id}-contact-event`, type: 'contact' as const, at: createdAt, description: `Recruiter contacted: ${recruiter}` }, { id: `${id}-scheduled-event`, type: 'interview_scheduled' as const, at: updatedAt, description: 'Next interview scheduled' }] : []),
        ...(index === 0 ? [{ id: `${id}-completed-event`, type: 'interview_completed' as const, at: updatedAt, description: 'Phone interview completed · Next round' }] : []),
      ],
    }
  })
}
