// Gera as capas de compartilhamento (public/og/*.jpg) e o apple-touch-icon a partir de covers.html.
// Precisa do Chrome instalado e do playwright-core (não fica nas dependências do projeto):
//   npm i --no-save playwright-core && node scripts/og/render.mjs
// CHROME=/caminho/do/chrome para outro executável.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')
const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '../../public')
const page = pathToFileURL(join(here, 'covers.html')).href
const executablePath = process.env.CHROME ?? '/usr/bin/google-chrome'

const browser = await chromium.launch({ executablePath, headless: true })
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } })
for (const id of ['home', 'camara-escura', 'negativos']) {
  await tab.goto(`${page}?page=${id}`)
  await tab.evaluate(() => document.fonts.ready)
  await tab.waitForTimeout(300)
  await tab.screenshot({ path: join(out, 'og', `${id}.jpg`), type: 'jpeg', quality: 86 })
  console.log(`og/${id}.jpg`)
}

// Ícone para iOS (180×180), igual ao favicon.
const icon = await browser.newPage({ viewport: { width: 180, height: 180 } })
await icon.goto(pathToFileURL(join(out, 'favicon.svg')).href)
await icon.screenshot({ path: join(out, 'apple-touch-icon.png') })
console.log('apple-touch-icon.png')
await browser.close()
