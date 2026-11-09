import { useEffect, useRef, useState } from 'react'
import type { RenderParams } from '../lib/filmMath'
import { getRenderer, type FilmSource } from '../lib/filmRenderer'

interface Props {
  source: FilmSource | null
  /** Sem params = mostra a foto original colorida. */
  params?: RenderParams
  className?: string
  /** Limite de pixels de largura (performance). */
  maxWidth?: number
  ariaLabel?: string
}

/** Canvas que renderiza a simulação do filme, ajustado à largura do container × DPR. */
export function FilmCanvas({ source, params, className, maxWidth = 1600, ariaLabel }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width * Math.min(window.devicePixelRatio || 1, 2))
      setWidth((prev) => (Math.abs(prev - w) > 8 ? w : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const key = params ? JSON.stringify(params) : 'original'

  useEffect(() => {
    const el = ref.current
    if (!el || !source || !width) return
    const id = requestAnimationFrame(() => {
      const w = Math.min(width, maxWidth)
      if (!params) {
        el.width = Math.min(w, source.width)
        el.height = Math.round((el.width * source.height) / source.width)
        el.getContext('2d')!.drawImage(source, 0, 0, el.width, el.height)
        return
      }
      getRenderer().render(source, el, params, w)
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key, width, maxWidth])

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{ aspectRatio: source ? `${source.width} / ${source.height}` : '3 / 2' }}
    />
  )
}
