import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import './globals.css'

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
  description: 'Biodiversity frontier intelligence for Santa Catarina — discover where new species await.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCondensed.variable} dark h-full`}>
      <body className="bg-slate-950 text-slate-100 h-full overflow-hidden font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
