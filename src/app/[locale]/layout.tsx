import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import '../globals.css'

const barlow = Barlow({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow',
})

const barlowCondensed = Barlow_Condensed({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
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
      className={`${barlow.variable} ${barlowCondensed.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="bg-[--bg] text-[--text-primary] h-full overflow-hidden font-sans antialiased">
        <ThemeProvider attribute="data-theme" defaultTheme="dark" disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
