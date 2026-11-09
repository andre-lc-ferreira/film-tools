import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import Home from './pages/Home'
import { applySeo } from './lib/seo'

// Cada ferramenta vira um arquivo separado: a home carrega rápido e só baixa o que for usado.
const Darkroom = lazy(() => import('./pages/Darkroom'))
const Negatives = lazy(() => import('./pages/Negatives'))

export default function App() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
    applySeo(location.pathname)
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <Suspense fallback={null}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/camara-escura" element={<Darkroom />} />
            <Route path="/negativos" element={<Negatives />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}
