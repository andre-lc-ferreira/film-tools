import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { FILMS } from '../data/films'
import type { FilmId } from '../data/types'

interface Props {
  value: FilmId
  onChange: (id: FilmId) => void
}

export function FilmPicker({ value, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = track.current?.querySelector<HTMLElement>(`[data-film="${value}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [value])

  const active = FILMS.find((f) => f.id === value)!

  return (
    <div>
      <div className="films" ref={track} role="radiogroup" aria-label="Filme">
        {FILMS.map((film) => {
          const isActive = film.id === value
          return (
            <motion.button
              key={film.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              data-film={film.id}
              className={`canister ${isActive ? 'is-active' : ''}`}
              onClick={() => onChange(film.id)}
              animate={{ scale: isActive ? 1 : 0.86, opacity: isActive ? 1 : 0.6, y: isActive ? -6 : 0 }}
              whileTap={{ scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              style={{ '--c1': film.colors[0], '--c2': film.colors[1] } as CSSProperties}
            >
              <span className="canister__cap" aria-hidden />
              <span className="canister__body">
                <span className="canister__brand">{film.brand}</span>
                <span className="canister__name">{film.name}</span>
                <span className="canister__iso">{film.iso}</span>
              </span>
              <span className="canister__cap canister__cap--bottom" aria-hidden />
              <span className="canister__leader" aria-hidden />
            </motion.button>
          )
        })}
      </div>
      <motion.p key={active.id} className="hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <strong>
          {active.brand} {active.name} · ISO {active.iso}
        </strong>{' '}
        — {active.description}
      </motion.p>
    </div>
  )
}
