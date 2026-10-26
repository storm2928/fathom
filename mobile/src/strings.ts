import { useLanguage } from '@fathom/shell/i18n';
import { stringsFor } from './appStrings';
import { DEVICE } from './app/device';

export type { AppStrings } from './appStrings';

/**
 * Text that exists only in the app (see appStrings.ts), in the words that are
 * true on this device.
 */
export function useAppStrings() {
  const { language } = useLanguage();
  return stringsFor(language === 'fr' ? 'fr' : 'en', DEVICE);
}
