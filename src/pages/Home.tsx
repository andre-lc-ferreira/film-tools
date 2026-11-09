import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { TOOLS } from '../data/tools'

export default function Home() {
  return (
    <div className="app home">
      <header className="home__head">
        <motion.p className="home__eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Laboratório analógico
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          Ferramentas para fotografia em filme
        </motion.h1>
        <motion.p className="home__lead" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          Escolha uma ferramenta para começar.
        </motion.p>
      </header>

      <main className="tools">
        {TOOLS.map((tool, i) => (
          <motion.div
            key={tool.id}
            className="tools__item"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 260, damping: 24 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link to={tool.path} className="tool" style={{ '--accent': tool.accent } as CSSProperties}>
              <span className="tool__icon" aria-hidden>
                <span className="tool__lamp" />
              </span>
              <span className="tool__body">
                <span className="tool__name">{tool.name}</span>
                <span className="tool__tagline">{tool.tagline}</span>
                <span className="tool__desc">{tool.description}</span>
                <span className="tool__tags">
                  {tool.tags.map((t) => (
                    <span key={t} className="tool__tag">
                      {t}
                    </span>
                  ))}
                </span>
              </span>
              <span className="tool__arrow" aria-hidden>
                →
              </span>
            </Link>
          </motion.div>
        ))}

        <motion.div
          className="tool tool--soon"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + TOOLS.length * 0.07 }}
        >
          <span className="tool__body">
            <span className="tool__name">Mais ferramentas em breve</span>
            <span className="tool__desc">Novas ferramentas vão aparecer aqui.</span>
          </span>
        </motion.div>
      </main>
    </div>
  )
}
