import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChemistryPanel } from '../components/ChemistryPanel'
import { ComparePreview } from '../components/ComparePreview'
import { ContactStrip } from '../components/ContactStrip'
import { DevelopSequence } from '../components/DevelopSequence'
import { DevTimeCard } from '../components/DevTimeCard'
import { FilmPicker } from '../components/FilmPicker'
import { PushPullControl } from '../components/PushPullControl'
import { SamplePicker } from '../components/SamplePicker'
import { Section } from '../components/Section'
import { DEVELOPER_BY_ID } from '../data/developers'
import { FILM_BY_ID } from '../data/films'
import { SAMPLES } from '../data/samples'
import type { DeveloperId, FilmId } from '../data/types'
import { availableDevelopers, computeDevTime, displayEI, effectiveEI, stopsLabel } from '../lib/devTime'
import { paramsFor } from '../lib/filmMath'
import { prepareSource, type FilmSource } from '../lib/filmRenderer'

const PREFERRED_DEVS: DeveloperId[] = ['id11-stock', 'd76-stock', 'ddx-1-4', 'xtol-stock']

type CompareMode = 'box' | 'original'

export default function Darkroom() {
  const [filmId, setFilmId] = useState<FilmId>('hp5-plus-400')
  const [developerId, setDeveloperId] = useState<DeveloperId>('id11-stock')
  const [stops, setStops] = useState(2)
  const [temp, setTemp] = useState(20)
  const [sampleId, setSampleId] = useState(SAMPLES[0].id)
  const [customUrl, setCustomUrl] = useState<string | null>(null)
  const [source, setSource] = useState<FilmSource | null>(null)
  const [compare, setCompare] = useState<CompareMode>('box')
  const [developing, setDeveloping] = useState(false)

  const film = FILM_BY_ID[filmId]
  const developers = useMemo(() => availableDevelopers(filmId), [filmId])

  // Garante um revelador válido para o filme escolhido.
  useEffect(() => {
    if (!developers.some((d) => d.id === developerId)) {
      const next = PREFERRED_DEVS.find((id) => developers.some((d) => d.id === id)) ?? developers[0].id
      setDeveloperId(next)
    }
  }, [developers, developerId])

  const developer = DEVELOPER_BY_ID[developerId]
  const result = computeDevTime(filmId, developerId, stops, temp)

  // Carrega a foto escolhida.
  const imageUrl = sampleId === 'custom' && customUrl ? customUrl : (SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]).src
  useEffect(() => {
    let alive = true
    prepareSource(imageUrl)
      .then((s) => alive && setSource(s))
      .catch((err) => console.error('Falha ao carregar imagem', err))
    return () => {
      alive = false
    }
  }, [imageUrl])

  const resultParams = useMemo(() => paramsFor(film, developer, stops), [film, developer, stops])
  const boxParams = useMemo(() => paramsFor(film, developer, 0), [film, developer])
  const reference = compare === 'original' ? undefined : boxParams
  const referenceLabel = compare === 'original' ? 'Original' : `ISO ${film.iso}`
  const resultLabel = `EI ${displayEI(effectiveEI(film.iso, stops))} · ${stopsLabel(stops)}`

  const handleUpload = (file: File) => {
    if (customUrl) URL.revokeObjectURL(customUrl)
    setCustomUrl(URL.createObjectURL(file))
    setSampleId('custom')
  }

  const sampleCredit = SAMPLES.find((s) => s.id === sampleId)

  return (
    <div className="app">
      <header className="top">
        <motion.div className="brand" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="back" aria-label="Voltar para as ferramentas">
            ←
          </Link>
          <span className="brand__lamp" aria-hidden />
          <div>
            <h1>Câmara Escura</h1>
            <p>Simulador de revelação preto e branco</p>
          </div>
        </motion.div>
      </header>

      <main className="layout">
        <section className="preview" aria-label="Pré-visualização">
          <ComparePreview
            source={source}
            reference={reference}
            result={resultParams}
            referenceLabel={referenceLabel}
            resultLabel={resultLabel}
            flashKey={`${filmId}-${imageUrl}`}
          />
          <div className="preview__bar">
            <div className="toggle toggle--small" role="radiogroup" aria-label="Comparar com">
              {(['box', 'original'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={compare === m} className={compare === m ? 'is-active' : ''} onClick={() => setCompare(m)}>
                  {compare === m && <motion.span layoutId="cmp-bg" className="toggle__bg" />}
                  <span>{m === 'box' ? 'vs. box speed' : 'vs. original'}</span>
                </button>
              ))}
            </div>
            <span className="preview__hint">Arraste para comparar</span>
          </div>
        </section>

        <div className="controls">
          <Section index="01" title="Foto">
            <SamplePicker selected={sampleId} customUrl={customUrl} onSelectSample={setSampleId} onUpload={handleUpload} />
            {sampleCredit && (
              <p className="credit">
                Foto: <a href={sampleCredit.url} target="_blank" rel="noreferrer">{sampleCredit.author}</a> / Unsplash
              </p>
            )}
          </Section>

          <Section index="02" title="Filme">
            <FilmPicker value={filmId} onChange={setFilmId} />
          </Section>

          <Section index="03" title="Química">
            <ChemistryPanel developers={developers} value={developerId} onChange={setDeveloperId} temp={temp} onTempChange={setTemp} />
          </Section>

          <Section index="04" title="Push / Pull">
            <PushPullControl iso={film.iso} value={stops} onChange={setStops} />
          </Section>

          {result && (
            <Section index="05" title="Revelação">
              <DevTimeCard result={result} stops={stops} temp={temp} developerName={`${developer.name} ${developer.dilution}`} onDevelop={() => setDeveloping(true)} />
            </Section>
          )}

          <Section index="06" title="Tira de contato">
            <p className="hint">O mesmo frame em cada EI. Toque para escolher.</p>
            <ContactStrip source={source} film={film} developer={developer} value={stops} onChange={setStops} />
          </Section>
        </div>
      </main>

      <footer className="foot">
        <p>
          Tempos de referência a 20 °C extraídos das fichas técnicas da Ilford (Film processing chart) e da Kodak (F-4017, F-4016, F-4043), além do Massive Dev Chart.
          Valores interpolados ou estimados são aproximações: sempre faça um teste com o seu equipamento.
        </p>
        <p>A simulação visual é uma aproximação artística da curva característica, do grão e da acutância.</p>
      </footer>

      <AnimatePresence>
        {developing && result && (
          <DevelopSequence
            source={source}
            params={resultParams}
            devMinutes={result.minutes}
            title={`${film.name} @ EI ${displayEI(result.ei)} · ${developer.name} ${developer.dilution}`}
            onClose={() => setDeveloping(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
