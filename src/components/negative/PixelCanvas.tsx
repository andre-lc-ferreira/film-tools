import { useEffect, useRef } from 'react'

interface Props {
  pixels: Uint8ClampedArray
  width: number
  height: number
  className?: string
  ariaLabel?: string
}

/** Desenha um buffer RGBA já processado. O tamanho na tela é controlado pelo CSS. */
export function PixelCanvas({ pixels, width, height, className, ariaLabel }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || pixels.length !== width * height * 4) return
    if (el.width !== width) el.width = width
    if (el.height !== height) el.height = height
    el.getContext('2d')!.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0)
  }, [pixels, width, height])

  return <canvas ref={ref} className={className} role="img" aria-label={ariaLabel} style={{ aspectRatio: `${width} / ${height}` }} />
}
