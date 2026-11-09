import { absolute, seoFor } from '../data/seo'

const SITE_URL = import.meta.env.VITE_SITE_URL ?? ''

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.setAttribute('content', value)
}

/** Atualiza as tags do <head> ao navegar entre páginas (o HTML inicial já vem certo do build). */
export function applySeo(pathname: string) {
  const page = seoFor(pathname)
  const url = absolute(SITE_URL, page.path)
  const image = absolute(SITE_URL, page.image)
  document.title = page.title
  setMeta('name', 'description', page.description)
  setMeta('name', 'keywords', page.keywords.join(', '))
  setMeta('property', 'og:title', page.shareTitle)
  setMeta('property', 'og:description', page.description)
  setMeta('property', 'og:url', url)
  setMeta('property', 'og:image', image)
  setMeta('property', 'og:image:secure_url', image)
  setMeta('property', 'og:image:alt', page.imageAlt)
  setMeta('name', 'twitter:title', page.shareTitle)
  setMeta('name', 'twitter:description', page.description)
  setMeta('name', 'twitter:image', image)
  setMeta('name', 'twitter:image:alt', page.imageAlt)
  document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
}
