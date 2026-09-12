import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import '../globals.css'

// IBM Plex Sans carries everything. It is a humanist face built for technical
// documentation, which is what this is: it stays legible at the 11-12px the
// dense panels use, its figures are even-width so a column of counts lines up
// without asking for a separate mono, and it reads institutional rather than
// branded — the same register GBIF gets from a plain system stack, with the
// difference that it renders identically on every machine.
const plexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans-face',
})

// Condensed is for headings and dense labels only, where the full-width face
// would wrap. Same family, so it never reads as a second typeface.
const plexCondensed = IBM_Plex_Sans_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-condensed-face',
})

export const metadata: Metadata = {
  title: 'BioFrontier SC',
  description: 'Biodiversity frontier intelligence for Santa Catarina.',
}

export function generateStaticParams() {
  return [{ locale: 'pt-BR' }, { locale: 'en' }, { locale: 'es' }]
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      className={`${plexSans.variable} ${plexCondensed.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint, which is the whole point: React cannot set
            this without rendering first, so a returning dark-mode reader would
            get a full white flash on every navigation.

            Light is the default rather than the OS preference. This is a public
            map that people arrive at from a link, and it should look the same
            as the screenshot they came from; the dark theme is a choice someone
            makes, which is then remembered. Wrapped in try/catch because
            localStorage throws outright in some privacy modes — a theme is not
            worth a blank page. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('biofrontier-theme');`
              + `if(t!=='light'&&t!=='dark'){t='light'}`
              + `var e=document.documentElement;if(t==='dark'){e.classList.add('dark')}`
              + `e.style.colorScheme=t}catch(_){}})()`,
          }}
        />
      </head>
      <body className="bg-slate-100 text-slate-900 h-full overflow-hidden font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
