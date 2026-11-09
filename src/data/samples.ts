export interface Sample {
  id: string
  label: string
  src: string
  author: string
  url: string
}

const base = import.meta.env.BASE_URL

export const SAMPLES: Sample[] = [
  { id: '453', label: 'Show', src: `${base}samples/453.jpg`, author: 'Gonzalo Poblete', url: 'https://unsplash.com/photos/C1tnzdAmPE8' },
  { id: '1027', label: 'Retrato', src: `${base}samples/1027.jpg`, author: 'Roksolana Zasiadko', url: 'https://unsplash.com/photos/LyeduBb2Auk' },
  { id: '342', label: 'Rua', src: `${base}samples/342.jpg`, author: 'Steven Lewis', url: 'https://unsplash.com/photos/r4He4Btlsro' },
  { id: '823', label: 'Fotógrafa', src: `${base}samples/823.jpg`, author: 'Benjamin Combs', url: 'https://unsplash.com/photos/hiAdjnXZxl8' },
  { id: '1015', label: 'Paisagem', src: `${base}samples/1015.jpg`, author: 'Alexey Topolyanskiy', url: 'https://unsplash.com/photos/-oWyJoSqBRM' },
  { id: '1033', label: 'Arquitetura', src: `${base}samples/1033.jpg`, author: 'Erez Attias', url: 'https://unsplash.com/photos/KqVHRmHVwwM' },
]
