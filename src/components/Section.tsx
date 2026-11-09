import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export function Section({ index, title, children, aside }: { index: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <motion.section
      className="section"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <h2 className="section__title">
        <span className="section__index mono">{index}</span>
        {title}
        {aside && <span className="section__aside">{aside}</span>}
      </h2>
      {children}
    </motion.section>
  )
}
