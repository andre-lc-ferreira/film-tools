import { motion } from 'motion/react'
import { useState } from 'react'
import type { Developer, Film } from '../data/types'
import { displayEI, effectiveEI, MAX_STOPS, MIN_STOPS } from '../lib/devTime'
import { paramsFor } from '../lib/filmMath'
import type { FilmSource } from '../lib/filmRenderer'
import { FilmCanvas } from './FilmCanvas'

interface Props {
  source: FilmSource | null
  film: Film
  developer: Developer | undefined
  value: number
  onChange: (stops: number) => void
}

const STOPS = Array.from({ length: MAX_STOPS - MIN_STOPS + 1 }, (_, i) => MIN_STOPS + i)

export function ContactStrip({ source, film, developer, value, onChange }: Props) {
  const [negative, setNegative] = useState(false)

  return (
    <div className="strip-wrap">
      <div className="toggle" role="radiogroup" aria-label="Modo da tira">
        {[false, true].map((neg) => (
          <button key={String(neg)} type="button" role="radio" aria-checked={negative === neg} className={negative === neg ? 'is-active' : ''} onClick={() => setNegative(neg)}>
            {negative === neg && <motion.span layoutId="toggle-bg" className="toggle__bg" />}
            <span>{neg ? 'Negativo' : 'Positivo'}</span>
          </button>
        ))}
      </div>

      <div className={`strip ${negative ? 'strip--neg' : ''}`}>
        <div className="strip__edge mono" aria-hidden>
          {film.brand.toUpperCase()} {film.name.toUpperCase()} ▸ {film.iso}
        </div>
        <div className="strip__frames">
          {STOPS.map((s, i) => (
            <motion.button
              key={s}
              type="button"
              className={`frame ${s === value ? 'is-active' : ''}`}
              onClick={() => onChange(s)}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              aria-label={`EI ${displayEI(effectiveEI(film.iso, s))}`}
            >
              <FilmCanvas source={source} params={paramsFor(film, developer, s, { negative: negative ? 1 : 0 })} maxWidth={360} className="frame__img" />
              <span className="frame__label mono">
                {i + 1}
                <small>
                  {s === 0 ? '±0' : s > 0 ? `+${s}` : s} · EI {displayEI(effectiveEI(film.iso, s))}
                </small>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
