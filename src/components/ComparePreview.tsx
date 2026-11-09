import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useRef, useState, type CSSProperties } from 'react'
import type { RenderParams } from '../lib/filmMath'
import type { FilmSource } from '../lib/filmRenderer'
import { FilmCanvas } from './FilmCanvas'

interface Props {
  source: FilmSource | null
  reference?: RenderParams
  result: RenderParams
  referenceLabel: string
  resultLabel: string
  /** Muda quando filme/foto mudam → dispara a animação de "flash". */
  flashKey: string
}

export function ComparePreview({ source, reference, result, referenceLabel, resultLabel, flashKey }: Props) {
  const [split, setSplit] = useState(0.5)
  const [dragging, setDragging] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const update = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setSplit(Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width)))
  }, [])

  return (
    <div
      ref={box}
      className={`compare ${dragging ? 'is-dragging' : ''}`}
      style={{ '--ratio': source ? source.width / source.height : 1.5 } as CSSProperties}
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        setDragging(true)
        update(e.clientX)
      }}
      onPointerMove={(e) => dragging && update(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <FilmCanvas source={source} params={result} className="compare__img" ariaLabel={resultLabel} />
      <div className="compare__ref" style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}>
        <FilmCanvas source={source} params={reference} className="compare__img" ariaLabel={referenceLabel} />
      </div>

      <div className="compare__handle" style={{ left: `${split * 100}%` }}>
        <span className="compare__knob" aria-hidden>
          ‹ ›
        </span>
      </div>

      <span className="compare__tag compare__tag--left">{referenceLabel}</span>
      <motion.span key={resultLabel} className="compare__tag compare__tag--right" initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {resultLabel}
      </motion.span>

      <AnimatePresence>
        <motion.div
          key={flashKey}
          className="compare__flash"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </AnimatePresence>

      {!source && <div className="compare__loading">Carregando foto…</div>}
    </div>
  )
}
