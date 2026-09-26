const colors = ['violet', 'blue', 'green', 'amber', 'rose', 'slate']
export function CompanyMark({ company, small = false }: { company: string; small?: boolean }) {
  const seed = Array.from(company).reduce((sum, letter) => sum + letter.charCodeAt(0), 0)
  return <span aria-hidden="true" className={`company-mark mark-${colors[seed % colors.length]} ${small ? 'small' : ''}`}>{company.slice(0, 1).toUpperCase()}</span>
}
