// plugins/cover-spin/index.ts
import { createPlugin } from '@/utils';
import { onPlayerApiReady, onUnload } from './renderer';
import { t } from '@/i18n';

export default createPlugin({
  name: () => t('plugins.cover-spin.name'),
  description: () => t('plugins.cover-spin.description'),
  restartNeeded: false, 
  config: {
    enabled: false,
  },
  renderer: {
    stop: onUnload,
    onPlayerApiReady,
  },
});