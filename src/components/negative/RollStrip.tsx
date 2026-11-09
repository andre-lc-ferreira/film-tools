import { motion } from 'motion/react'
import { memo, useMemo } from 'react'
import { extract } from '../../lib/negative/geometry'
import { analyze, processRaster } from '../../lib/negative/invert'
import type { Raster } from '../../lib/negative/raster'
import { settingsOf, type FrameEdit } from '../../lib/negative/roll'
import { PixelCanvas } from './PixelCanvas'

export interface StripFrame {
  id: string
  name: string
  thumb: Raster | null
  edit: FrameEdit
  error: string | null
}

interface Props {
  frames: StripFrame[]
  activeId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}

/** Tira do rolo: miniaturas já invertidas, com o recorte e os ajustes de cada quadro. */
export function RollStrip({ frames, activeId, onSelect, onRemove, onAdd }: Props) {
  return (
    <div className="roll" role="listbox" aria-label="Quadros do rolo">
      {frames.map((f, i) => (
        <div key={f.id} className={`roll__frame ${f.id === activeId ? 'is-active' : ''}`}>
          <motion.button
            type="button"
            role="option"
            aria-selected={f.id === activeId}
            aria-label={`Quadro ${i + 1}: ${f.name}`}
            title={f.name}
            className="roll__btn"
            whileTap={{ scale: 0.94 }}
            onClick={() => onSelect(f.id)}
          >
            {f.error ? <span className="roll__state">Erro</span> : f.thumb ? <Thumb thumb={f.thumb} edit={f.edit} /> : <span className="roll__state roll__state--loading" />}
            <span className="roll__num mono">{i + 1}</span>
          </motion.button>
          {f.id === activeId && (
            <button type="button" className="roll__remove" onClick={() => onRemove(f.id)} aria-label={`Remover ${f.name} do rolo`}>
              ×
            </button>
          )}
        </div>
      ))}
      <button type="button" className="roll__add" onClick={onAdd} aria-label="Adicionar negativos">
        ＋
      </button>
    </div>
  )
}

const Thumb = memo(function Thumb({ thumb, edit }: { thumb: Raster; edit: FrameEdit }) {
  const view = useMemo(() => {
    const r = extract(thumb, edit.orientation, edit.crop, 160)
    return { r, px: processRaster(r, settingsOf(edit), analyze(r, edit), 'rgba8') }
  }, [thumb, edit])
  return <PixelCanvas pixels={view.px} width={view.r.width} height={view.r.height} className="roll__img" />
})
