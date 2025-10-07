// menu + robot main icon 
import { createPlugin } from '@/utils';

const recognizers = {
  AHA: 'AHA Music',
  Shazam: 'Shazam',
} as const;

type Recognizer = typeof recognizers[keyof typeof recognizers];

interface Config {
  enabled: boolean;
  recognizer: Recognizer;
}

const urlFor = (r: Recognizer) =>
  r === recognizers.Shazam ? 'https://www.shazam.com/' : 'https://www.aha-music.com/';

export default createPlugin<unknown, unknown, unknown, Config>({
  name: () => 'Music Recognizer',
  description: () => 'Open AHA Music or Shazam based on your menu choice.',
  restartNeeded: true,

  config: {
    enabled: true,
    recognizer: recognizers.AHA,
  },

  menu: async ({ getConfig, setConfig }) => {
    const cfg = await getConfig();
    return [
      {
        label: 'Recognizer',
        submenu: [recognizers.AHA, recognizers.Shazam].map((r) => ({
          label: r,
          type: 'radio',
          checked: (cfg.recognizer || recognizers.AHA) === r,
          click() {
            setConfig({ recognizer: r as Recognizer });
          },
        })),
      },
      {
        label: 'Open website',
        click() {
          getConfig().then(({ recognizer }) => {
            const { shell } = require('electron') as typeof import('electron');
            shell.openExternal(urlFor((recognizer as Recognizer) || recognizers.AHA));
          });
        },
      },
    ];
  },
  renderer: {
    async start({ getConfig }) {
      const ICON_SVG = `
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"
             style="pointer-events:none;display:block;width:24px;height:24px">
          <path fill="currentColor"
            d="M12 2c4.418 0 8 3.582 8 8 0 3.04-1.36 4.52-2.3 5.28-.72.58-1.2 1.02-1.2 1.92
               0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.5 1.03-2.7 1.96-3.64.84-.83 1.54-1.52 1.54-2.86
               0-1.657-1.343-3-3-3S6 9.343 6 11c0 1.105-.895 2-2 2s-2-.895-2-2C2 6.477 6.477 2 11 2h1z"/>
        </svg>
      `;

      const urlFromConfig = async () => {
        try {
          const { recognizer } = await getConfig<Config>();
          return urlFor((recognizer as Recognizer) || recognizers.AHA);
        } catch {
          return urlFor(recognizers.AHA);
        }
      };

      const findRightControls = () => {
        const bar = document.querySelector<HTMLElement>('ytmusic-player-bar');
        if (!bar) return null;
        return (
          bar.querySelector<HTMLElement>('#right-controls #buttons') ||
          bar.querySelector<HTMLElement>('#right-controls') ||
          bar.querySelector<HTMLElement>('#buttons')
        );
      };

      // ROBOT ICON
      const ICON_ROBOT = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor"
            d="M12 2a2 2 0 0 0-2 2v1H8v2H7v2H5v2h14v-2h-2V7h-1V5h-2V4a2 2 0 0 0-2-2zM7 13v4h2v-4H7zm8 0v4h2v-4h-2z"/>
        </svg>
      `;

      const makeMainWrapper = () => {
        const exist = document.getElementById('music-tools-wrapper');
        if (exist) return exist;

        const wrapper = document.createElement('div');
        wrapper.id = 'music-tools-wrapper';
        Object.assign(wrapper.style, {
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
        });

        const toggle = document.createElement('button');
        toggle.innerHTML = ICON_ROBOT;
        toggle.title = 'Music Tools';
        Object.assign(toggle.style, {
          width: '40px',
          height: '40px',
          background: 'transparent',
          border: 'none',
          color: 'var(--yt-spec-text-primary,#fff)',
          cursor: 'pointer',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease',
        });

        const menu = document.createElement('div');
        menu.id = 'music-tools-menu';
        Object.assign(menu.style, {
          position: 'absolute',
          bottom: '45px',
          right: '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          opacity: '0',
          transform: 'translateY(10px)',
          pointerEvents: 'none',
          transition: 'all 0.2s ease',
        });

        toggle.addEventListener('click', () => {
          const open = menu.style.opacity === '1';
          menu.style.opacity = open ? '0' : '1';
          menu.style.transform = open ? 'translateY(10px)' : 'translateY(0)';
          menu.style.pointerEvents = open ? 'none' : 'auto';
          toggle.style.transform = open ? 'scale(1)' : 'scale(1.1)';
        });

        wrapper.append(toggle, menu);
        return wrapper;
      };