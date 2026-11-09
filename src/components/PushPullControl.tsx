import { AnimatePresence, motion } from 'motion/react'
import { displayEI, effectiveEI, MAX_STOPS, MIN_STOPS } from '../lib/devTime'

interface Props {
  iso: number
  value: number
  onChange: (stops: number) => void
}

const STOPS = Array.from({ length: MAX_STOPS - MIN_STOPS + 1 }, (_, i) => MIN_STOPS + i)

function explain(stops: number): { title: string; body: string } {
  if (stops === 0)
    return { title: 'Velocidade nominal', body: 'Exposto e revelado como o fabricante indica: tonalidade equilibrada e grão padrão.' }
  if (stops > 0)
    return {
      title: `Push de ${stops} stop${stops > 1 ? 's' : ''}`,
      body: `Subexposto ${stops}× e revelado por mais tempo. O contraste e o grão aumentam, os brancos ficam mais duros e as sombras perdem detalhe${stops >= 3 ? ' (muito!)' : ''}.`,
    }
  return {
    title: `Pull de ${-stops} stop${stops < -1 ? 's' : ''}`,
    body: 'Superexposto e revelado por menos tempo. O contraste cai, os tons ficam suaves e as sombras ganham detalhe. Ótimo para cenas de luz dura.',
  }
}

export function PushPullControl({ iso, value, onChange }: Props) {
  const info = explain(value)

  return (
    <div className="pushpull">
      <div className="pushpull__track" role="radiogroup" aria-label="Push ou pull">
        {STOPS.map((s) => {
          const isActive = s === value
          const kind = s === 0 ? 'box' : s > 0 ? 'push' : 'pull'
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={`stop stop--${kind} ${isActive ? 'is-active' : ''}`}
              onClick={() => onChange(s)}
            >
              {isActive && <motion.span layoutId="stop-knob" className="stop__knob" transition={{ type: 'spring', stiffness: 520, damping: 30 }} />}
              <span className="stop__value">{s === 0 ? '0' : s > 0 ? `+${s}` : s}</span>
              <span className="stop__ei mono">{displayEI(effectiveEI(iso, s))}</span>
            </button>
          )
        })}
      </div>
      <div className="pushpull__legend" aria-hidden>
        <span>◀ Pull</span>
        <span>EI</span>
        <span>Push ▶</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          className={`explain explain--${value === 0 ? 'box' : value > 0 ? 'push' : 'pull'}`}
          initial={{ opacity: 0, x: value >= 0 ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: value >= 0 ? -24 : 24 }}
          transition={{ duration: 0.22 }}
        >
          <strong>{info.title}</strong>
          <p>{info.body}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
