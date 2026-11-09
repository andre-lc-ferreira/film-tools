import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { headTags, PAGES, seoFor, sitemap } from './src/data/seo.ts'

const START = '<!-- seo:start -->'
const END = '<!-- seo:end -->'

/**
 * SEO por página: injeta título, descrição, Open Graph e Twitter Card no <head> e, no build,
 * gera um HTML estático por rota (dist/negativos/index.html…) com as tags daquela página.
 * Os robôs de compartilhamento não executam JavaScript, então é isso que garante a capa certa.
 */
function seo(siteUrl: string): Plugin {
  const inject = (html: string, path: string) => {
    const block = `${START}\n    ${headTags(seoFor(path), siteUrl)}\n    ${END}`
    return html.includes(START) ? html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block) : html.replace('<!--seo-->', block)
  }
  return {
    name: 'seo-pages',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => inject(html, ctx.originalUrl?.split('?')[0] ?? '/'),
    },
    // Depois do plugin de HTML do Vite, para já existir o index.html final.
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') return
      const html = String(index.source)
      for (const page of PAGES) {
        if (page.path === '/') continue
        this.emitFile({ type: 'asset', fileName: `${page.path.slice(1)}/index.html`, source: inject(html, page.path) })
      }
      if (siteUrl) {
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(siteUrl, new Date().toISOString().slice(0, 10)) })
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml\n` })
      } else {
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: 'User-agent: *\nAllow: /\n' })
        this.warn('VITE_SITE_URL não definido: as capas de compartilhamento precisam de URL absoluta. Ex.: VITE_SITE_URL=https://seu-dominio.com npm run build')
      }
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  return {
    plugins: [react(), seo(env.VITE_SITE_URL ?? '')],
    server: { host: true },
  }
})
