import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PageResult } from '../../domain/career'

export function Pagination({ result, onPage }: { result: Pick<PageResult<unknown>, 'total' | 'page' | 'pageSize'>; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  if (pages < 2) return null
  return <div className="pagination"><span>{result.total} items</span><div><button className="icon-button" aria-label="Previous page" disabled={result.page === 1} onClick={() => onPage(result.page - 1)}><ChevronLeft size={16} /></button><span>Page {result.page} of {pages}</span><button className="icon-button" aria-label="Next page" disabled={result.page === pages} onClick={() => onPage(result.page + 1)}><ChevronRight size={16} /></button></div></div>
}
