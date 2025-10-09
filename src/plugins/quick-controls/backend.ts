// Quick Controls plugin backend
import is from 'electron-is';
import type { QuickControlsConfig } from './types';
import type { BackendContext } from '@/types/contexts';

const getPlatformController = async () => {
  if (is.macOS()) {
    const { MacOSController } = await import('./platforms/macos');
    return new MacOSController();
  } else if (is.windows()) {
    const { WindowsController } = await import('./platforms/windows');
    return new WindowsController();
  } else if (is.linux()) {
    const { LinuxController } = await import('./platforms/linux');
    return new LinuxController();
  } else {
    throw new Error(
      'Platform not supported. Only macOS, Windows and Linux are currently supported.',
    );
  }
};

export const onBackendLoad = async ({
  getConfig,
  window,
}: BackendContext<QuickControlsConfig>) => {
  console.log('[Quick Controls] loading');

  const config = await getConfig();
  const platformController = await getPlatformController();
  await platformController.initialize(window, config);
};
