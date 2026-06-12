import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

const messageLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en:     () => import('../messages/en.json'),
  'pt-BR': () => import('../messages/pt-BR.json'),
  es:     () => import('../messages/es.json'),
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale
  }
  const loader = messageLoaders[locale] ?? messageLoaders[routing.defaultLocale]
  return {
    locale,
    messages: (await loader()).default,
  }
})
