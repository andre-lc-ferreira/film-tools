import { motion } from 'motion/react'
import { useRef } from 'react'
import { SAMPLES } from '../data/samples'

interface Props {
  selected: string
  customUrl: string | null
  onSelectSample: (id: string) => void
  onUpload: (file: File) => void
}

export function SamplePicker({ selected, customUrl, onSelectSample, onUpload }: Props) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="samples" role="listbox" aria-label="Foto de exemplo">
      <motion.button
        type="button"
        className={`sample sample--upload ${selected === 'custom' ? 'is-active' : ''}`}
        whileTap={{ scale: 0.92 }}
        onClick={() => input.current?.click()}
        aria-label="Usar minha foto"
      >
        {customUrl ? <img src={customUrl} alt="" /> : <span className="sample__plus" aria-hidden>＋</span>}
        <span className="sample__label">{customUrl ? 'Trocar foto' : 'Sua foto'}</span>
      </motion.button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
      {SAMPLES.map((s) => (
        <motion.button
          key={s.id}
          type="button"
          role="option"
          aria-selected={selected === s.id}
          className={`sample ${selected === s.id ? 'is-active' : ''}`}
          whileTap={{ scale: 0.92 }}
          onClick={() => onSelectSample(s.id)}
        >
          <img src={s.src} alt="" loading="lazy" />
          <span className="sample__label">{s.label}</span>
        </motion.button>
      ))}
    </div>
  )
}
