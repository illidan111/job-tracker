import type { CompanionKind } from '../domain/journey'
import { useEffect, useRef } from 'react'

// Original geometric illustrations. Shared silhouette language, no image requests.
export function Companion({ kind, stage = 1, celebrating = false, xp = 0 }: { kind: CompanionKind; stage?: number; celebrating?: boolean; xp?: number }) {
  const drawing = useRef<SVGSVGElement>(null), previousXp = useRef(xp)
  useEffect(() => {
    const earned = xp > previousXp.current
    previousXp.current = xp
    if (!earned || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = drawing.current?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px) rotate(-2deg)' }, { transform: 'translateY(0)' }], { duration: 400, easing: 'ease-out' })
    return () => animation?.cancel()
  }, [xp])
  const fur = kind === 'fox' ? '#b96d46' : kind === 'cat' ? '#737680' : '#b1a69a'
  const shade = kind === 'fox' ? '#944a32' : kind === 'cat' ? '#525763' : '#87796e'
  return <svg ref={drawing} className="companion-art" viewBox="0 0 320 280" role="img" aria-label={`${kind === 'hare' ? 'Hare' : kind === 'cat' ? 'Cat' : 'Fox'} companion, evolution ${stage}`}>
    <ellipse cx="161" cy="250" rx="89" ry="10" fill="currentColor" opacity=".07" />
    {kind !== 'hare' && <><path d={kind === 'fox' ? 'M182 223C264 246 291 202 279 145C263 166 231 166 219 187C213 200 200 204 182 201Z' : 'M192 226C259 244 288 191 255 171C236 161 223 178 244 183C263 189 245 221 203 205Z'} fill={shade} />{kind === 'fox' && <path d="M279 145C284 169 282 188 274 203L245 179C259 170 268 162 279 145Z" fill="#f4e6d0" />}</>}
    {kind === 'hare' && <circle cx="221" cy="217" r="21" fill="#e0d5c5" />}
    <path d="M108 170C96 188 91 220 97 240C122 252 196 252 216 240C224 216 213 183 200 171Z" fill={fur} />
    <path d="M145 178C126 193 127 225 130 243H183C188 218 182 188 172 178Z" fill="#f4e6d0" />
    <path d="M117 213L112 244M199 212L202 244" stroke={shade} strokeWidth="9" strokeLinecap="round" />
    {kind === 'hare' ? <><path d="M111 118C87 70 93 19 109 17C127 14 141 81 137 116M168 112C167 64 186 19 199 26C220 38 200 101 193 124" fill={fur} /><path d="M117 98L109 38M184 99L195 44" stroke="#d9b9a4" strokeWidth="10" strokeLinecap="round" /></> : <><path d="M92 129L84 49Q84 38 96 44L149 86M169 86L219 43Q232 39 229 53L217 130" fill={fur} /><path d="M100 94L97 61L126 88M189 88L217 61L212 99" fill={shade} /></>}
    <path d="M91 104Q106 77 155 79Q205 77 220 109L234 142Q224 181 160 199Q99 184 80 146Z" fill={fur} />
    <path d="M83 140Q112 126 150 151L160 163L170 150Q204 124 231 139Q219 177 160 192Q103 178 83 140Z" fill="#f4e6d0" />
    {kind === 'cat' && <path d="M142 81L149 105M164 81L164 102M185 83L178 103" stroke={shade} strokeWidth="7" strokeLinecap="round" />}
    <path d={celebrating ? 'M119 131Q127 123 135 131M183 131Q191 123 199 131' : 'M125 126V133M190 126V133'} stroke="#322c2b" strokeWidth="5" strokeLinecap="round" fill="none" />
    <path d="M152 154Q160 149 168 154L161 162Z" fill="#322c2b" /><path d="M161 161V167Q153 173 148 167M161 167Q168 173 173 167" stroke="#322c2b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {stage >= 2 && <><path d="M113 183Q159 204 206 182L204 199Q161 218 112 198Z" fill="#414d57" /><path d="M188 198L203 228L219 216L201 191Z" fill="#414d57" /></>}
    {stage >= 3 && <><circle cx="160" cy="203" r="10" fill="#e5b767" /><path d="M160 195L164 203L160 211L156 203Z" fill="#725638" /></>}
    {stage >= 4 && <path d="M105 88Q160 57 216 89L212 100Q160 78 108 101Z M120 83L130 46Q162 28 194 53L201 85Z" fill="#414d57" />}
  </svg>
}
