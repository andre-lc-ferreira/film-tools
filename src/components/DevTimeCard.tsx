import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { formatMinutes, stopsLabel, type DevTimeResult } from '../lib/devTime'

interface Props {
  result: DevTimeResult
  stops: number
  temp: number
  developerName: string
  onDevelop: () => void
}

const KIND_LABEL = {
  tabulated: { text: 'Tabelado', cls: 'ok' },
  interpolated: { text: 'Interpolado', cls: 'mid' },
  extrapolated: { text: 'Estimado', cls: 'warn' },
} as const

function AnimatedTime({ minutes }: { minutes: number }) {
  const spring = useSpring(minutes, { stiffness: 120, damping: 20 })
  const text = useTransform(spring, (v) => formatMinutes(v))
  useEffect(() => spring.set(minutes), [minutes, spring])
  return <motion.span className="time__big mono">{text}</motion.span>
}

export function DevTimeCard({ result, stops, temp, developerName, onDevelop }: Props) {
  const kind = KIND_LABEL[result.kind]
  const isKodak = result.source.startsWith('Kodak')

  return (
    <div className="time">
      <div className="time__top">
        <span className="time__label">Tempo de revelação</span>
        <motion.span key={result.kind} className={`badge badge--${kind.cls}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {kind.text}
        </motion.span>
      </div>

      <AnimatedTime minutes={result.minutes} />
      <p className="time__meta">
        {developerName} · {temp.toFixed(1)} °C · {stopsLabel(stops)}
        {temp !== 20 && <> · a 20 °C seria {formatMinutes(result.minutesAt20)}</>}
      </p>

      <AnimatePresence initial={false}>
        {result.warnings.map((w) => (
          <motion.p key={w} className="warn" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            ⚠ {w}
          </motion.p>
        ))}
      </AnimatePresence>

      <ol className="steps">
        <li>
          <span>Revelador</span>
          <span className="mono">{formatMinutes(result.minutes)}</span>
        </li>
        <li>
          <span>Interruptor (stop ou água)</span>
          <span className="mono">0:10</span>
        </li>
        <li>
          <span>Fixador</span>
          <span className="mono">5:00</span>
        </li>
        <li>
          <span>Lavagem</span>
          <span className="mono">10:00</span>
        </li>
      </ol>
      <p className="time__agitation">
        Agitação: {isKodak ? '5–7 inversões nos primeiros 30 s e depois a cada 30 s.' : '4 inversões nos primeiros 10 s e depois 4 a cada minuto.'}
      </p>
      <p className="time__source">Fonte: {result.source}{result.kind !== 'tabulated' && ' (com ajuste calculado)'}</p>

      <motion.button type="button" className="cta" onClick={onDevelop} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>
        <span className="cta__dot" aria-hidden />
        Revelar o filme
      </motion.button>
    </div>
  )
}
