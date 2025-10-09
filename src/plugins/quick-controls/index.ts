// Quick Controls plugin entry
import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { onBackendLoad } from './backend';
import { renderer } from './renderer';
import type { QuickControlsConfig } from './types';

export default createPlugin({
  name: () => t('plugins.quick-controls.name') || 'Quick Controls',
  description: () =>
    t('plugins.quick-controls.description') || 'Dock/tray-click',
  restartNeeded: true,
  config: {
    enabled: true,
    showPlaybackControls: true,
    showLikeButton: true,
    showRepeatControl: true,
    showShuffleControl: true,
  } as QuickControlsConfig,
  backend: onBackendLoad,
  renderer: renderer,
});

export type { QuickControlsConfig } from './types';
