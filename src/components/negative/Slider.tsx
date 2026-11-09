import type { CSSProperties } from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  /** Valor neutro: a barra preenche a partir dele e o botão de reset aparece fora dele. */
  neutral: number
  format: (v: number) => string
  onChange: (v: number) => void
  /** Gradiente opcional do trilho (ex.: azul → amarelo na temperatura). */
  track?: string
}

export function Slider({ label, value, min, max, step, neutral, format, onChange, track }: Props) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const a = Math.min(pct(value), pct(neutral))
  const b = Math.max(pct(value), pct(neutral))
  const changed = Math.abs(value - neutral) > step / 2

  return (
    <div className="slider">
      <div className="slider__head">
        <span>{label}</span>
        <span className="slider__value">
          {changed && (
            <button type="button" className="slider__reset" onClick={() => onChange(neutral)} aria-label={`Restaurar ${label}`}>
              ↺
            </button>
          )}
          <strong className="mono">{format(value)}</strong>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(neutral)}
        style={{ '--a': `${a}%`, '--b': `${b}%`, '--track': track ?? 'var(--surface-3)' } as CSSProperties}
        className={track ? 'has-track' : ''}
      />
    </div>
  )
}
