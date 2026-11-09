import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react'
import { Link } from 'react-router'
import { CropEditor } from '../components/negative/CropEditor'
import { PixelCanvas } from '../components/negative/PixelCanvas'
import { RollStrip } from '../components/negative/RollStrip'
import { Slider } from '../components/negative/Slider'
import { Section } from '../components/Section'
import { downloadBlob, EXPORT_EXT, type ExportFormat } from '../lib/negative/encode'
import { cropPixels, extract, flipCrop, FULL_CROP, orientedSize, rotate, rotateCrop, sampleArea } from '../lib/negative/geometry'
import { analyze, DEFAULT_ADJUSTMENTS, processRaster, rasterToRgba, type Adjustments, type FilmKind } from '../lib/negative/invert'
import type { DecodedImage, Raster, SourceFormat } from '../lib/negative/raster'
import { ZipWriter } from '../lib/negative/zip'
import { DEFAULT_EDIT, exportName, frameAnalysis, loadFrame, PREVIEW_SIDE, renderExport, settingsOf, type FrameEdit } from '../lib/negative/roll'

const FRAME_SIDE = 1400

const KINDS: { id: FilmKind; label: string; hint: string }[] = [
  { id: 'color', label: 'Colorido', hint: 'C-41: remove a máscara laranja e equilibra as cores.' },
  { id: 'bw', label: 'P&B', hint: 'Preto e branco: inverte a luminância.' },
  { id: 'positive', label: 'Cromo', hint: 'Slide/positivo (E-6): não inverte, só ajusta.' },
]

const ASPECTS: { id: string; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Livre', ratio: null },
  { id: '3:2', label: '3:2 · 35mm', ratio: 3 / 2 },
  { id: '4:3', label: '4:3 · 6×4,5', ratio: 4 / 3 },
  { id: '1:1', label: '1:1 · 6×6', ratio: 1 },
  { id: '5:4', label: '5:4 · 6×7 / 4×5', ratio: 5 / 4 },
  { id: '17:6', label: '17:6 · panorâmico', ratio: 17 / 6 },
]

interface FrameInfo {
  width: number
  height: number
  bitDepth: 8 | 16
  format: SourceFormat
  fileSize: number
}

interface Frame {
  id: string
  file: File
  name: string
  edit: FrameEdit
  thumb: Raster | null
  info: FrameInfo | null
  error: string | null
}

/** Só o quadro aberto fica na memória em resolução total; os outros guardam só a miniatura. */
interface ActiveImage {
  id: string
  image: DecodedImage
  proxy: Raster
}

type Progress = { done: number; total: number; name: string }

let nextId = 1

export default function Negatives() {
  const [frames, setFrames] = useState<Frame[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [active, setActive] = useState<ActiveImage | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const [view, setView] = useState<'result' | 'crop'>('crop')
  const [picking, setPicking] = useState(false)
  const [showNegative, setShowNegative] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('tiff')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const frame = frames.find((f) => f.id === activeId) ?? null
  const edit = frame?.edit ?? DEFAULT_EDIT

  const addFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/') || /\.(tiff?|jpe?g|png|webp)$/i.test(f.name))
      if (!images.length) return
      // Quadros novos herdam tipo de filme, base e ajustes do quadro aberto (é o mesmo rolo, em geral).
      const inherit = frame ? { kind: frame.edit.kind, base: frame.edit.base, adj: frame.edit.adj } : {}
      const added: Frame[] = images.map((file) => ({
        id: `f${nextId++}`,
        file,
        name: file.name,
        edit: { ...DEFAULT_EDIT, ...inherit },
        thumb: null,
        info: null,
        error: null,
      }))
      setFrames((fs) => [...fs, ...added])
      if (!activeIdRef.current) {
        setActiveId(added[0].id)
        const f = added[0].name.toLowerCase()
        setFormat(/\.png$/.test(f) ? 'png' : /\.jpe?g$/.test(f) ? 'jpeg' : 'tiff')
      }
    },
    [frame],
  )

  // Fila de carregamento: primeiro o quadro aberto, depois as miniaturas do resto, um por vez.
  useEffect(() => {
    if (busyId) return
    const needActive = activeId && active?.id !== activeId ? frames.find((f) => f.id === activeId && !f.error) : undefined
    const next = needActive ?? frames.find((f) => !f.thumb && !f.error)
    if (!next) return
    setBusyId(next.id)
    // Dá um respiro para a interface antes do trabalho pesado.
    setTimeout(() => {
      loadFrame(next.file)
        .then((l) => {
          const { width, height, bitDepth } = l.image.raster
          setFrames((fs) =>
            fs.map((f) =>
              f.id === next.id
                ? { ...f, thumb: l.thumb, info: { width, height, bitDepth, format: l.image.format, fileSize: l.image.fileSize }, edit: f.info ? f.edit : { ...f.edit, portrait: height > width, crop: l.detected ?? f.edit.crop } }
                : f,
            ),
          )
          if (activeIdRef.current === next.id) setActive({ id: next.id, image: l.image, proxy: l.proxy })
        })
        .catch((err) => {
          console.error(err)
          setFrames((fs) => fs.map((f) => (f.id === next.id ? { ...f, error: err instanceof Error ? err.message : 'Não foi possível abrir o arquivo.' } : f)))
        })
        .finally(() => setBusyId(null))
    }, 20)
  }, [busyId, frames, activeId, active])

  // Solta arquivos em qualquer lugar da página.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.files.length) addFiles(Array.from(e.dataTransfer.files))
    }
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [addFiles])

  const select = useCallback((id: string) => {
    setActiveId(id)
    setPicking(false)
  }, [])

  // ← / → navegam pelo rolo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const i = frames.findIndex((f) => f.id === activeId)
      const next = frames[i + (e.key === 'ArrowRight' ? 1 : -1)]
      if (next) select(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frames, activeId, select])

  const remove = (id: string) => {
    const i = frames.findIndex((f) => f.id === id)
    const rest = frames.filter((f) => f.id !== id)
    setFrames(rest)
    if (id === activeId) {
      const next = rest[Math.min(i, rest.length - 1)]
      setActiveId(next?.id ?? null)
      setActive(null)
    }
  }

  const updateEdit = (fn: (e: FrameEdit) => FrameEdit) => setFrames((fs) => fs.map((f) => (f.id === activeId ? { ...f, edit: fn(f.edit) } : f)))
  const patch = (p: Partial<FrameEdit>) => updateEdit((e) => ({ ...e, ...p }))
  const setA = <K extends keyof Adjustments>(key: K) => (v: Adjustments[K]) => updateEdit((e) => ({ ...e, adj: { ...e.adj, [key]: v } }))

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice((m) => (m === msg ? null : m)), 2500)
  }

  const copyToAll = (what: 'adjust' | 'crop') => {
    setFrames((fs) =>
      fs.map((f) => {
        if (f.id === activeId) return f
        if (what === 'adjust') return { ...f, edit: { ...f.edit, kind: edit.kind, base: edit.base, adj: edit.adj } }
        return { ...f, edit: { ...f.edit, orientation: edit.orientation, crop: edit.crop, aspectId: edit.aspectId, portrait: edit.portrait } }
      }),
    )
    flash(what === 'adjust' ? `Ajustes copiados para ${frames.length - 1} quadro(s)` : `Recorte copiado para ${frames.length - 1} quadro(s)`)
  }

  // ---------- Prévia ----------
  // Enquanto o quadro carrega em resolução total, a miniatura serve de prévia.
  const proxy = active && active.id === activeId ? active.proxy : (frame?.thumb ?? null)
  const ready = !!active && active.id === activeId

  // Valores "atrasados": o arrasto dos controles continua fluido enquanto a prévia recalcula.
  const dCrop = useDeferredValue(edit.crop)
  const dAdj = useDeferredValue(edit.adj)
  const settings = useMemo(() => settingsOf({ kind: edit.kind, base: edit.base, adj: dAdj }), [edit.kind, edit.base, dAdj])

  const fullView = useMemo(() => (proxy ? extract(proxy, edit.orientation, FULL_CROP, FRAME_SIDE) : null), [proxy, edit.orientation])
  const cropped = useMemo(() => (proxy ? extract(proxy, edit.orientation, dCrop, PREVIEW_SIDE) : null), [proxy, edit.orientation, dCrop])
  // Os pontos de preto/branco vêm só da área recortada (sem bordas e furos do filme).
  const analysis = useMemo(() => (cropped ? analyze(cropped, { kind: edit.kind, base: edit.base }) : null), [cropped, edit.kind, edit.base])

  const shown = view === 'crop' ? fullView : cropped
  const pixels = useMemo(() => {
    if (!shown || !analysis) return null
    return showNegative ? rasterToRgba(shown) : processRaster(shown, settings, analysis, 'rgba8')
  }, [shown, analysis, settings, showNegative])

  const info = frame?.info ?? null
  const fullSize = info ? orientedSize(info.width, info.height, edit.orientation) : null
  const out = info ? cropPixels(info.width, info.height, edit.orientation, edit.crop) : null
  const aspectBase = ASPECTS.find((a) => a.id === edit.aspectId)?.ratio ?? null
  const aspect = aspectBase && edit.portrait ? 1 / aspectBase : aspectBase
  const anyBits16 = frames.some((f) => f.info?.bitDepth === 16)
  const exporting = progress !== null

  const applyAspect = (id: string, isPortrait = edit.portrait) => {
    const r0 = ASPECTS.find((a) => a.id === id)?.ratio
    if (!r0 || !fullSize) {
      patch({ aspectId: id, portrait: isPortrait })
      return
    }
    const r = (isPortrait ? 1 / r0 : r0) / (fullSize.width / fullSize.height)
    // Maior retângulo na proporção, centrado no recorte atual.
    let w = 1
    let h = w / r
    if (h > 1) {
      h = 1
      w = r
    }
    const c = edit.crop
    const cx = Math.min(1 - w / 2, Math.max(w / 2, c.x + c.w / 2))
    const cy = Math.min(1 - h / 2, Math.max(h / 2, c.y + c.h / 2))
    patch({ aspectId: id, portrait: isPortrait, crop: { x: cx - w / 2, y: cy - h / 2, w, h } })
  }

  const turn = (dir: 1 | -1) => updateEdit((e) => ({ ...e, orientation: rotate(e.orientation, dir), crop: rotateCrop(e.crop, dir), portrait: !e.portrait }))
  const flip = () => updateEdit((e) => ({ ...e, orientation: { ...e.orientation, flipH: !e.orientation.flipH }, crop: flipCrop(e.crop) }))

  // ---------- Exportação ----------
  const exportFrames = async (list: Frame[]) => {
    setExportError(null)
    const failed: string[] = []
    // Um quadro: baixa o arquivo direto. Vários: tudo num .zip (sem recompressão).
    const zip = list.length > 1 ? new ZipWriter() : null
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      setProgress({ done: i, total: list.length, name: f.name })
      await new Promise((r) => setTimeout(r, 60))
      try {
        // Reaproveita o quadro aberto; os outros são lidos de novo do arquivo, um por vez.
        const loaded = active?.id === f.id ? active : { id: f.id, ...(await loadFrame(f.file)) }
        const blob = await renderExport(loaded.image, f.edit, frameAnalysis(loaded.proxy, f.edit), format)
        const name = exportName(loaded.image, EXPORT_EXT[format])
        if (zip) await zip.add(name, blob)
        else downloadBlob(blob, name)
      } catch (err) {
        console.error(err)
        failed.push(`${f.name}: ${err instanceof Error ? err.message : 'falha'}`)
      }
    }
    if (zip && failed.length < list.length) {
      setProgress({ done: list.length - 1, total: list.length, name: 'Montando o .zip…' })
      await new Promise((r) => setTimeout(r, 30))
      downloadBlob(zip.finish(), `positivos-${new Date().toISOString().slice(0, 10)}.zip`)
    }
    setProgress(null)
    if (failed.length) setExportError(`Não foi possível exportar: ${failed.join(' · ')}`)
  }

  const k = (n: number) => String(n).padStart(2, '0')
  let idx = 0
  const nextIndex = () => k(++idx)

  return (
    <div className="app neg">
      <header className="top">
        <motion.div className="brand" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="back" aria-label="Voltar para as ferramentas">
            ←
          </Link>
          <span className="brand__lamp brand__lamp--amber" aria-hidden />
          <div>
            <h1>Negativo → Positivo</h1>
            <p>Recorte, inverta e exporte seus scans</p>
          </div>
        </motion.div>
      </header>

      <FileInput onFiles={addFiles} inputRef={fileInput} />

      {!frame ? (
        <main className="neg__empty">
          <Dropzone onPick={() => fileInput.current?.click()} />
        </main>
      ) : (
        <main className="layout">
          <section className="preview" aria-label="Pré-visualização">
            <div className="neg__stage" style={{ '--ratio': shown ? shown.width / shown.height : 1.5 } as CSSProperties}>
              {frame.error ? (
                <div className="neg__placeholder">
                  <strong>Não foi possível abrir este arquivo</strong>
                  <span>{frame.error}</span>
                </div>
              ) : pixels && shown && fullView && view === 'crop' ? (
                <CropEditor
                  pixels={pixels}
                  width={fullView.width}
                  height={fullView.height}
                  crop={edit.crop}
                  onChange={(crop) => patch({ crop })}
                  aspect={aspect}
                  picking={picking}
                  onPick={(nx, ny) => {
                    patch({ base: sampleArea(fullView, nx, ny, 4) })
                    setPicking(false)
                  }}
                />
              ) : pixels && shown ? (
                <PixelCanvas pixels={pixels} width={shown.width} height={shown.height} className="neg__img" ariaLabel="Resultado" />
              ) : (
                <div className="neg__placeholder">
                  <span className="brand__lamp brand__lamp--amber" aria-hidden />
                  <span>Abrindo o negativo…</span>
                </div>
              )}
              {proxy && !ready && !frame.error && <span className="neg__loading">Carregando em resolução total…</span>}
            </div>
            <div className="preview__bar">
              <div className="toggle toggle--small" role="radiogroup" aria-label="Visualização">
                {(['crop', 'result'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={view === m}
                    className={view === m ? 'is-active' : ''}
                    onClick={() => {
                      setView(m)
                      if (m === 'result') setPicking(false)
                    }}
                  >
                    {view === m && <motion.span layoutId="neg-view" className="toggle__bg" />}
                    <span>{m === 'crop' ? 'Recortar' : 'Resultado'}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`hold ${showNegative ? 'is-active' : ''}`}
                onPointerDown={() => setShowNegative(true)}
                onPointerUp={() => setShowNegative(false)}
                onPointerLeave={() => setShowNegative(false)}
                onPointerCancel={() => setShowNegative(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                Segure: negativo
              </button>
            </div>
            <RollStrip frames={frames} activeId={activeId} onSelect={select} onRemove={remove} onAdd={() => fileInput.current?.click()} />
          </section>

          <div className="controls">
            <Section
              index={nextIndex()}
              title={`Quadro ${frames.indexOf(frame) + 1} de ${frames.length}`}
              aside={
                <button type="button" className="link-btn" onClick={() => fileInput.current?.click()}>
                  Adicionar
                </button>
              }
            >
              <p className="neg__file mono">{frame.name}</p>
              {info ? (
                <p className="hint">
                  <strong>
                    {info.width} × {info.height} px
                  </strong>{' '}
                  · {info.bitDepth} bits por canal · {formatLabel(info.format)} · {formatBytes(info.fileSize)}
                </p>
              ) : (
                <p className="hint">{frame.error ?? 'Lendo arquivo…'}</p>
              )}
              {frames.length === 1 && <p className="hint">Você pode enviar vários negativos de uma vez: cada quadro guarda o próprio recorte e ajustes.</p>}
            </Section>

            <Section index={nextIndex()} title="Tipo de filme">
              <div className="toggle" role="radiogroup" aria-label="Tipo de filme">
                {KINDS.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={edit.kind === t.id} className={edit.kind === t.id ? 'is-active' : ''} onClick={() => patch({ kind: t.id })}>
                    {edit.kind === t.id && <motion.span layoutId="neg-kind" className="toggle__bg" />}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              <p className="hint">{KINDS.find((t) => t.id === edit.kind)!.hint}</p>
            </Section>

            <Section
              index={nextIndex()}
              title="Recorte e orientação"
              aside={
                frames.length > 1 && (
                  <button type="button" className="link-btn" onClick={() => copyToAll('crop')}>
                    Copiar para todos
                  </button>
                )
              }
            >
              <div className="chips" role="radiogroup" aria-label="Proporção">
                {ASPECTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={edit.aspectId === a.id}
                    className={`chip chip--flat ${edit.aspectId === a.id ? 'is-active' : ''}`}
                    onClick={() => {
                      applyAspect(a.id)
                      setView('crop')
                    }}
                  >
                    {edit.aspectId === a.id && <motion.span layoutId="neg-aspect" className="chip__bg" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
                    <span className="chip__name">{a.label}</span>
                  </button>
                ))}
              </div>
              <div className="neg__tools">
                <button type="button" className="ghost" onClick={() => turn(-1)} aria-label="Girar 90° à esquerda">
                  ⟲ 90°
                </button>
                <button type="button" className="ghost" onClick={() => turn(1)} aria-label="Girar 90° à direita">
                  ⟳ 90°
                </button>
                <button type="button" className={`ghost ${edit.orientation.flipH ? 'is-on' : ''}`} onClick={flip} aria-pressed={edit.orientation.flipH}>
                  ⇋ Espelhar
                </button>
                {aspectBase && aspectBase !== 1 && (
                  <button type="button" className="ghost" onClick={() => applyAspect(edit.aspectId, !edit.portrait)}>
                    {edit.portrait ? '▯ Vertical' : '▭ Horizontal'}
                  </button>
                )}
                <button type="button" className="ghost" onClick={() => patch({ crop: FULL_CROP, aspectId: 'free' })}>
                  Quadro inteiro
                </button>
              </div>
              <p className="hint">
                Corte as bordas e os furos do filme: o equilíbrio de cor é medido só dentro do recorte. Em fotos de mesa de luz, o filme é detectado sozinho ao importar. Espelhe se o scan foi feito pelo lado da emulsão.
              </p>
            </Section>

            {edit.kind !== 'positive' && (
              <Section index={nextIndex()} title="Base do filme">
                <div className="base">
                  <span
                    className={`base__swatch ${edit.base ? '' : 'is-auto'}`}
                    style={edit.base ? { background: `rgb(${edit.base.map((v) => Math.round(v * 255)).join(',')})` } : undefined}
                    aria-hidden
                  />
                  <div className="base__text">
                    <strong>{edit.base ? 'Amostrada' : 'Automática'}</strong>
                    <span>{edit.base ? 'A base vira o preto mais profundo.' : 'Medida pelas áreas mais claras do negativo.'}</span>
                  </div>
                </div>
                <div className="neg__tools">
                  <button
                    type="button"
                    className={`ghost ${picking ? 'is-on' : ''}`}
                    onClick={() => {
                      setView('crop')
                      setPicking((p) => !p)
                    }}
                  >
                    {picking ? 'Cancelar' : '◎ Amostrar base'}
                  </button>
                  {edit.base && (
                    <button type="button" className="ghost" onClick={() => patch({ base: null })}>
                      Usar automática
                    </button>
                  )}
                </div>
              </Section>
            )}

            <Section
              index={nextIndex()}
              title="Ajustes"
              aside={
                <button type="button" className="link-btn" onClick={() => patch({ adj: DEFAULT_ADJUSTMENTS })}>
                  Restaurar
                </button>
              }
            >
              <div className="sliders">
                <Slider label="Exposição" value={edit.adj.exposure} min={-2} max={2} step={0.05} neutral={0} format={signed(2, ' EV')} onChange={setA('exposure')} />
                <Slider label="Contraste" value={edit.adj.contrast} min={-1} max={1} step={0.01} neutral={0} format={pct} onChange={setA('contrast')} />
                <Slider label="Pretos" value={edit.adj.blacks} min={-1} max={1} step={0.01} neutral={0} format={pct} onChange={setA('blacks')} />
                <Slider label="Brancos" value={edit.adj.whites} min={-1} max={1} step={0.01} neutral={0} format={pct} onChange={setA('whites')} />
                {edit.kind !== 'bw' && (
                  <>
                    <Slider
                      label="Temperatura"
                      value={edit.adj.temperature}
                      min={-1}
                      max={1}
                      step={0.01}
                      neutral={0}
                      format={pct}
                      onChange={setA('temperature')}
                      track="linear-gradient(90deg, #3d6fb0, #8a8a8a, #e0a63a)"
                    />
                    <Slider
                      label="Matiz"
                      value={edit.adj.tint}
                      min={-1}
                      max={1}
                      step={0.01}
                      neutral={0}
                      format={pct}
                      onChange={setA('tint')}
                      track="linear-gradient(90deg, #3e9a4f, #8a8a8a, #b2479a)"
                    />
                    <Slider label="Saturação" value={edit.adj.saturation} min={0} max={2} step={0.01} neutral={1} format={(v) => `${Math.round(v * 100)}%`} onChange={setA('saturation')} />
                  </>
                )}
              </div>
              <p className="hint">Toque duas vezes num controle para zerar.</p>
              {frames.length > 1 && (
                <button type="button" className="ghost neg__wide" onClick={() => copyToAll('adjust')}>
                  Aplicar tipo, base e ajustes a todos os quadros
                </button>
              )}
            </Section>

            <Section index={nextIndex()} title="Exportar">
              <div className="chips" role="radiogroup" aria-label="Formato">
                {(['tiff', 'png', 'jpeg'] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={format === f} className={`chip ${format === f ? 'is-active' : ''}`} onClick={() => setFormat(f)}>
                    {format === f && <motion.span layoutId="neg-format" className="chip__bg" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
                    <span className="chip__name">{f === 'tiff' ? 'TIFF' : f.toUpperCase()}</span>
                    <span className="chip__dil">{f === 'tiff' ? `${info?.bitDepth ?? 8} bits · sem perdas` : f === 'png' ? '8 bits · sem perdas' : '8 bits · qualidade 100'}</span>
                  </button>
                ))}
              </div>
              {out && (
                <p className="hint">
                  Saída: <strong className="mono">{out.w} × {out.h} px</strong> ({((out.w * out.h) / 1e6).toFixed(1)} MP), a mesma resolução do arquivo enviado, sem reamostragem.
                </p>
              )}
              {anyBits16 && format !== 'tiff' && <p className="warn-text">Há arquivos com 16 bits por canal. Para não perder gradação, exporte em TIFF.</p>}
              <button type="button" className="cta cta--amber" onClick={() => exportFrames([frame])} disabled={exporting || !ready}>
                {ready ? `Baixar este quadro (${EXPORT_EXT[format].toUpperCase()})` : 'Carregando…'}
              </button>
              {frames.length > 1 && (
                <button type="button" className="ghost neg__wide" onClick={() => exportFrames(frames.filter((f) => !f.error))} disabled={exporting}>
                  Baixar todos os {frames.filter((f) => !f.error).length} quadros (.zip)
                </button>
              )}
              {exportError && <p className="warn-text">{exportError}</p>}
            </Section>
          </div>
        </main>
      )}

      <AnimatePresence>
        {progress && (
          <motion.div key="busy" className="neg__busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="brand__lamp brand__lamp--amber" aria-hidden />
            <p>{progress.total > 1 ? `Exportando ${progress.done + 1} de ${progress.total}…` : 'Processando em resolução total…'}</p>
            <p className="neg__busy-name mono">{progress.name}</p>
          </motion.div>
        )}
        {notice && (
          <motion.div key="toast" className="neg__toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const ACCEPT = 'image/jpeg,image/png,image/tiff,image/webp,.tif,.tiff'

function FileInput({ onFiles, inputRef }: { onFiles: (f: File[]) => void; inputRef: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      multiple
      hidden
      onChange={(e) => {
        const files = Array.from(e.target.files ?? [])
        if (files.length) onFiles(files)
        e.target.value = ''
      }}
    />
  )
}

function Dropzone({ onPick }: { onPick: () => void }) {
  const [over, setOver] = useState(false)
  return (
    <motion.button
      type="button"
      className={`drop ${over ? 'is-over' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onPick}
      onDragOver={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
    >
      <span className="drop__film" aria-hidden>
        <span />
      </span>
      <strong>Envie os scans dos negativos</strong>
      <span className="drop__sub">Toque para escolher ou arraste os arquivos aqui. Pode ser o rolo inteiro.</span>
      <span className="drop__formats mono">TIFF 8/16 bits · JPEG · PNG · WebP</span>
    </motion.button>
  )
}

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`
const signed = (digits: number, unit: string) => (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}${unit}`

function formatLabel(f: SourceFormat) {
  return { jpeg: 'JPEG', png: 'PNG', tiff: 'TIFF', webp: 'WebP', other: 'Imagem' }[f]
}

function formatBytes(n: number) {
  return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`
}
