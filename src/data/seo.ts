/**
 * SEO e capas de compartilhamento de cada página.
 * Usado em dois lugares: no build (vite.config.ts gera um HTML estático por rota, que é o que
 * WhatsApp, Instagram, Facebook, X e LinkedIn leem — eles não executam JavaScript) e no
 * navegador (src/lib/seo.ts atualiza as tags ao navegar entre páginas).
 */

export const SITE_NAME = 'Laboratório Analógico'
export const LOCALE = 'pt_BR'
export const THEME_COLOR = '#0d0b0b'

export interface PageSeo {
  path: string
  /** Título completo da aba e dos resultados de busca. */
  title: string
  /** Título mais curto para o card de compartilhamento. */
  shareTitle: string
  description: string
  /** Caminho da capa (1200×630) dentro de public/. */
  image: string
  imageAlt: string
  keywords: string[]
}

export const PAGES: PageSeo[] = [
  {
    path: '/',
    title: 'Laboratório Analógico · Ferramentas para fotografia em filme',
    shareTitle: 'Laboratório Analógico',
    description:
      'Ferramentas gratuitas para quem fotografa em filme: simule a revelação P&B com push e pull e transforme scans de negativos em positivos na resolução original.',
    image: '/og/home.jpg',
    imageAlt: 'Tira de filme com um negativo laranja e a mesma foto revelada em positivo',
    keywords: ['fotografia analógica', 'filme fotográfico', 'revelação', 'negativo', 'câmara escura'],
  },
  {
    path: '/camara-escura',
    title: 'Câmara Escura · Simulador de revelação P&B com push e pull',
    shareTitle: 'Câmara Escura — simulador de revelação P&B',
    description:
      'Escolha o filme (HP5+, Tri-X, Delta, T-Max…), o revelador e a temperatura: veja o tempo de revelação tabelado e o efeito de push e pull na foto.',
    image: '/og/camara-escura.jpg',
    imageAlt: 'Foto em preto e branco iluminada pela luz vermelha de segurança da câmara escura',
    keywords: ['tempo de revelação', 'push pull', 'revelação preto e branco', 'HP5', 'Tri-X', 'ID-11', 'D-76', 'Rodinal'],
  },
  {
    path: '/negativos',
    title: 'Negativo → Positivo · Inverta scans de negativos online',
    shareTitle: 'Negativo → Positivo — inverta seus scans',
    description:
      'Envie os scans do rolo, recorte, ajuste exposição e cor e inverta negativos coloridos (C-41), P&B ou cromos. Exporte em TIFF 16 bits na mesma resolução do original.',
    image: '/og/negativos.jpg',
    imageAlt: 'Mesma foto de paisagem metade como negativo colorido laranja e metade como positivo',
    keywords: ['inverter negativo', 'negativo para positivo', 'scan de negativo', 'C-41', 'máscara laranja', 'TIFF 16 bits'],
  },
]

export const PAGE_BY_PATH: Record<string, PageSeo> = Object.fromEntries(PAGES.map((p) => [p.path, p]))

export const seoFor = (path: string): PageSeo => PAGE_BY_PATH[path.replace(/\/+$/, '') || '/'] ?? PAGE_BY_PATH['/']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Junta a URL do site com um caminho. Sem siteUrl, devolve o caminho relativo. */
export const absolute = (siteUrl: string, path: string) => `${siteUrl.replace(/\/+$/, '')}${path}`

/** Tags do <head> de uma página, já como HTML. */
export function headTags(page: PageSeo, siteUrl: string): string {
  const url = absolute(siteUrl, page.path)
  const image = absolute(siteUrl, page.image)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': page.path === '/' ? 'WebSite' : 'WebApplication',
    name: page.shareTitle,
    description: page.description,
    url,
    image,
    inLanguage: 'pt-BR',
    ...(page.path === '/'
      ? {}
      : { applicationCategory: 'MultimediaApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' }, isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: absolute(siteUrl, '/') } }),
  }
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="keywords" content="${esc(page.keywords.join(', '))}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    siteUrl && `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:locale" content="${LOCALE}" />`,
    `<meta property="og:title" content="${esc(page.shareTitle)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    siteUrl && `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    siteUrl.startsWith('https://') && `<meta property="og:image:secure_url" content="${esc(image)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(page.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.shareTitle)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(page.imageAlt)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ')
}

export function sitemap(siteUrl: string, lastmod: string): string {
  const urls = PAGES.map(
    (p) => `  <url>\n    <loc>${esc(absolute(siteUrl, p.path))}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${p.path === '/' ? '1.0' : '0.8'}</priority>\n  </url>`,
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
