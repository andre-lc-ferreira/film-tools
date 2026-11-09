import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { Developer, DeveloperId } from '../data/types'
import { MAX_TEMP, MIN_TEMP } from '../lib/devTime'

interface Props {
  developers: Developer[]
  value: DeveloperId
  onChange: (id: DeveloperId) => void
  temp: number
  onTempChange: (t: number) => void
}

export function ChemistryPanel({ developers, value, onChange, temp, onTempChange }: Props) {
  const active = developers.find((d) => d.id === value)
  const pct = (temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)

  return (
    <div className="chem">
      <div className="chips" role="radiogroup" aria-label="Revelador">
        {developers.map((d) => {
          const isActive = d.id === value
          return (
            <button key={d.id} type="button" role="radio" aria-checked={isActive} className={`chip ${isActive ? 'is-active' : ''}`} onClick={() => onChange(d.id)}>
              {isActive && <motion.span layoutId="chip-bg" className="chip__bg" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
              <span className="chip__name">{d.name}</span>
              <span className="chip__dil">{d.dilution}</span>
            </button>
          )
        })}
      </div>
      {active && (
        <motion.p key={active.id} className="hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {active.description}
        </motion.p>
      )}

      <label className="temp">
        <span className="temp__head">
          <span>Temperatura do revelador</span>
          <motion.strong key={temp} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="mono">
            {temp.toFixed(1)} °C
          </motion.strong>
        </span>
        <span className="temp__track" style={{ '--pct': pct } as CSSProperties}>
          <input type="range" min={MIN_TEMP} max={MAX_TEMP} step={0.5} value={temp} onChange={(e) => onTempChange(Number(e.target.value))} aria-label="Temperatura em graus Celsius" />
        </span>
        <span className="temp__scale mono" aria-hidden>
          <span>18°</span>
          <span>20°</span>
          <span>22°</span>
          <span>24°</span>
        </span>
      </label>
    </div>
  )
}
