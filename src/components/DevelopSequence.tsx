import { animate, AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMinutes } from '../lib/devTime'
import type { RenderParams } from '../lib/filmMath'
import type { FilmSource } from '../lib/filmRenderer'
import { FilmCanvas } from './FilmCanvas'

type Phase = 'load' | 'dev' | 'stop' | 'fix' | 'wash' | 'dry' | 'print' | 'done'

const PHASES: { id: Phase; label: string }[] = [
  { id: 'load', label: 'Carregar' },
  { id: 'dev', label: 'Revelador' },
  { id: 'stop', label: 'Interruptor' },
  { id: 'fix', label: 'Fixador' },
  { id: 'wash', label: 'Lavagem' },
  { id: 'dry', label: 'Secagem' },
  { id: 'print', label: 'Ampliação' },
]

const LIQUID: Partial<Record<Phase, string>> = {
  dev: '#9a5b1e',
  stop: '#d9b829',
  fix: '#a9a2c4',
  wash: '#4f8fc0',
}

const CAPTION: Record<Phase, string> = {
  load: 'No escuro total, o filme é enrolado na espiral e colocado no tanque…',
  dev: 'O revelador transforma a imagem latente em prata metálica.',
  stop: 'O interruptor para a revelação na hora certa.',
  fix: 'O fixador remove a prata não revelada: o negativo fica transparente e estável.',
  wash: 'Lavagem para tirar todo o fixador.',
  dry: 'Negativo pendurado para secar.',
  print: 'Ampliação: a luz atravessa o negativo e o papel revela no banho.',
  done: 'Cópia pronta!',
}

interface Props {
  source: FilmSource | null
  params: RenderParams
  devMinutes: number
  title: string
  onClose: () => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function DevelopSequence({ source, params, devMinutes, title, onClose }: Props) {
  const reduce = useReducedMotion()
  const speed = reduce ? 0.45 : 1
  const [phase, setPhase] = useState<Phase>('load')
  const [develop, setDevelop] = useState(0)
  const [fog, setFog] = useState(0.4)
  const [paper, setPaper] = useState(0)
  const [clock, setClock] = useState(0)
  const [inversions, setInversions] = useState(0)
  const [flash, setFlash] = useState(0)
  const run = useRef({ alive: false })
  const controls = useRef<{ stop: () => void }[]>([])
  const agitateTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const stopAll = () => {
    run.current.alive = false
    controls.current.forEach((c) => c.stop())
    controls.current = []
    clearInterval(agitateTimer.current)
  }

  useEffect(() => {
    const token = { alive: true }
    run.current = token
    const sequence = async () => {
      const wait = async (ms: number) => {
        await sleep(ms * speed)
        if (!token.alive) throw new Error('cancel')
      }
      const tween = (from: number, to: number, seconds: number, onUpdate: (v: number) => void) =>
        new Promise<void>((resolve) => {
          controls.current.push(animate(from, to, { duration: seconds * speed, ease: 'easeInOut', onUpdate, onComplete: resolve }))
        })
      try {
        await wait(1300)
        setPhase('dev')
        const devSeconds = 4.6
        const agitations = Math.max(3, Math.min(8, Math.round(devMinutes / 2)))
        agitateTimer.current = setInterval(() => setInversions((n) => n + 1), (devSeconds * 1000 * speed) / agitations)
        await tween(0, 1, devSeconds, (v) => {
          setDevelop(Math.round(v * 24) / 24)
          setClock(v * devMinutes)
        })
        clearInterval(agitateTimer.current)
        if (!token.alive) return
        setPhase('stop')
        await wait(900)
        setPhase('fix')
        await tween(0.4, 0, 1.6, (v) => setFog(Math.round(v * 20) / 20))
        setPhase('wash')
        await wait(1200)
        setPhase('dry')
        await wait(1100)
        setPhase('print')
        await tween(0, 1, 0.25, setFlash)
        await tween(1, 0, 0.5, setFlash)
        await tween(0, 1, 2.6, (v) => setPaper(Math.round(v * 30) / 30))
        setPhase('done')
      } catch {
        /* cancelado */
      }
    }
    sequence()
    return stopAll
  }, [devMinutes, speed])

  const skip = () => {
    stopAll()
    setDevelop(1)
    setFog(0)
    setPaper(1)
    setFlash(0)
    setClock(devMinutes)
    setPhase('done')
  }

  const isNegativeStage = phase !== 'print' && phase !== 'done'
  const filmParams = useMemo<RenderParams>(
    () => (isNegativeStage ? { ...params, negative: 1, develop } : { ...params, negative: 0, paper }),
    [isNegativeStage, params, develop, paper],
  )
  const phaseIndex = PHASES.findIndex((p) => p.id === phase)
  const liquid = LIQUID[phase]

  return (
    <motion.div className="seq" role="dialog" aria-modal="true" aria-label="Revelação" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="seq__safelight" aria-hidden />
      <header className="seq__head">
        <div>
          <p className="seq__eyebrow">Revelando</p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </header>

      <ol className="seq__steps">
        {PHASES.map((p, i) => (
          <li key={p.id} className={i < phaseIndex || phase === 'done' ? 'is-done' : i === phaseIndex ? 'is-current' : ''}>
            <span className="seq__dot">{i === phaseIndex && phase !== 'done' && <motion.span layoutId="seq-dot" className="seq__dot-fill" />}</span>
            <span className="seq__step-label">{p.label}</span>
          </li>
        ))}
      </ol>

      <div className="seq__stage">
        <AnimatePresence mode="popLayout">
          {isNegativeStage && phase !== 'dry' ? (
            <motion.div key="tank" className="tank-wrap" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8, y: -30 }}>
              <motion.div
                className="tank"
                animate={reduce ? {} : { rotate: phase === 'dev' ? (inversions % 2) * 180 : 0 }}
                transition={{ type: 'spring', stiffness: 160, damping: 16 }}
              >
                <svg viewBox="0 0 120 170" width="120" height="170" aria-hidden>
                  <defs>
                    <clipPath id="tank-inner">
                      <rect x="16" y="30" width="88" height="128" rx="10" />
                    </clipPath>
                  </defs>
                  <rect x="22" y="6" width="76" height="22" rx="6" fill="#2d2525" />
                  <rect x="50" y="0" width="20" height="10" rx="3" fill="#3a3030" />
                  <rect x="12" y="26" width="96" height="136" rx="14" fill="#1d1717" stroke="#3a3030" strokeWidth="3" />
                  <g clipPath="url(#tank-inner)">
                    <motion.rect
                      x="16"
                      width="88"
                      height="128"
                      initial={{ y: 158 }}
                      animate={{ y: liquid ? 34 : 158, fill: liquid ?? '#000000' }}
                      transition={{ duration: 0.7 * speed, ease: 'easeOut' }}
                    />
                    {phase === 'wash' &&
                      [0, 1, 2, 3, 4].map((i) => (
                        <motion.circle
                          key={i}
                          cx={30 + i * 15}
                          r={3 + (i % 2)}
                          fill="rgba(255,255,255,.5)"
                          initial={{ cy: 160, opacity: 0 }}
                          animate={{ cy: 40, opacity: [0, 1, 0] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                        />
                      ))}
                  </g>
                  {/* espiral */}
                  <g opacity="0.55" stroke="#000" strokeWidth="2" fill="none">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <line key={i} x1="24" x2="96" y1={50 + i * 18} y2={50 + i * 18} />
                    ))}
                  </g>
                </svg>
              </motion.div>
              <div className="tank__clock mono">
                {phase === 'load' ? '··:··' : phase === 'dev' ? formatMinutes(clock) : formatMinutes(devMinutes)}
                <small>/ {formatMinutes(devMinutes)}</small>
              </div>
              {phase === 'dev' && <p className="tank__inv">Inversões: {inversions * 4}</p>}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          className={`seq__film ${isNegativeStage ? 'is-negative' : 'is-print'} ${phase === 'dry' ? 'is-hanging' : ''}`}
          layout
          animate={phase === 'dry' ? { rotate: [-2, 2, -1, 0] } : { rotate: 0 }}
          transition={{ duration: 1.2 }}
        >
          {phase === 'dry' && <span className="clip" aria-hidden />}
          <div className="seq__frame">
            <FilmCanvas source={source} params={filmParams} maxWidth={900} className="seq__img" />
            {isNegativeStage && <div className="seq__fog" style={{ opacity: phase === 'load' ? 0.4 : fog }} />}
            {phase === 'load' && <div className="seq__dark" />}
          </div>
          {!isNegativeStage && <div className="tray" aria-hidden />}
        </motion.div>

        <div className="seq__flash" style={{ opacity: flash }} aria-hidden />
      </div>

      <AnimatePresence mode="wait">
        <motion.p key={phase} className="seq__caption" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {CAPTION[phase]}
        </motion.p>
      </AnimatePresence>

      <footer className="seq__foot">
        {phase === 'done' ? (
          <motion.button type="button" className="cta" onClick={onClose} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            Ver resultado
          </motion.button>
        ) : (
          <button type="button" className="ghost" onClick={skip}>
            Pular animação
          </button>
        )}
      </footer>
    </motion.div>
  )
}
