import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Crop } from '../../lib/negative/geometry'
import { PixelCanvas } from './PixelCanvas'

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move'

interface Props {
  pixels: Uint8ClampedArray
  width: number
  height: number
  crop: Crop
  onChange: (c: Crop) => void
  /** Proporção travada (largura/altura em pixels reais) ou null para livre. */
  aspect: number | null
  /** Modo conta-gotas: um toque devolve o ponto em vez de mexer no recorte. */
  picking: boolean
  onPick: (nx: number, ny: number) => void
}

const MIN = 0.04
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Imagem inteira com um retângulo de recorte arrastável (cantos redimensionam, centro move). */
export function CropEditor({ pixels, width, height, crop, onChange, aspect, picking, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; start: { x: number; y: number }; crop: Crop } | null>(null)
  const [active, setActive] = useState<Handle | null>(null)

  const point = (e: ReactPointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }
  }

  const onDown = (e: ReactPointerEvent) => {
    const p = point(e)
    if (picking) {
      onPick(p.x, p.y)
      return
    }
    const handle = ((e.target as HTMLElement).dataset.handle as Handle | undefined) ?? null
    if (!handle) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { handle, start: p, crop }
    setActive(handle)
  }

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = point(e)
    const dx = p.x - d.start.x
    const dy = p.y - d.start.y
    const c = d.crop

    if (d.handle === 'move') {
      onChange({ ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) })
      return
    }

    const east = d.handle === 'ne' || d.handle === 'se'
    const south = d.handle === 'sw' || d.handle === 'se'
    const ax = east ? c.x : c.x + c.w
    const ay = south ? c.y : c.y + c.h
    const availW = east ? 1 - ax : ax
    const availH = south ? 1 - ay : ay
    const px = clamp((east ? c.x + c.w : c.x) + dx, 0, 1)
    const py = clamp((south ? c.y + c.h : c.y) + dy, 0, 1)
    let w = Math.max(MIN, Math.abs(px - ax))
    let h = Math.max(MIN, Math.abs(py - ay))

    if (aspect) {
      // Proporção em coordenadas normalizadas (a imagem não é quadrada).
      const r = aspect / (width / height)
      w = Math.max(w, h * r)
      w = Math.min(w, availW, availH * r)
      h = w / r
    } else {
      w = Math.min(w, availW)
      h = Math.min(h, availH)
    }

    onChange({ x: east ? ax : ax - w, y: south ? ay : ay - h, w, h })
  }

  const onUp = () => {
    drag.current = null
    setActive(null)
  }

  return (
    <div
      ref={box}
      className={`cropper ${picking ? 'is-picking' : ''} ${active ? 'is-dragging' : ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <PixelCanvas pixels={pixels} width={width} height={height} className="cropper__img" ariaLabel="Quadro inteiro" />
      <div
        className="cropper__box"
        data-handle="move"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
      >
        <span className="cropper__grid" aria-hidden />
        {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
          <span key={h} data-handle={h} className={`cropper__handle cropper__handle--${h}`} aria-hidden />
        ))}
      </div>
      {picking && <div className="cropper__pickhint">Toque na borda do filme (área sem imagem)</div>}
    </div>
  )
}
