import { loadTranslations } from './i18n'

// Everything that shows text loads after the language's texts, since data
// files translate theirs when they load. Without the English file (offline,
// nothing saved) the app still starts, in Swedish.
void loadTranslations()
  .catch(() => {})
  .then(() => import('./start'))
