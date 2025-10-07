import { shell } from 'electron';

import { createPlugin } from '@/utils';

const aiSites = {
  ChatGPT: 'ChatGPT',
  Gemini: 'Gemini',
} as const;

type AiSite = (typeof aiSites)[keyof typeof aiSites];

interface Config {
  enabled: boolean;
  site: AiSite;
}

const urlFor = (s: AiSite) =>
  s === aiSites.Gemini
    ? 'https://gemini.google.com/'
    : 'https://chat.openai.com/';

export default createPlugin<unknown, unknown, unknown, Config>({
  name: () => 'Listen with AI',
  description: () => 'Open ChatGPT or Gemini based on your menu choice.',
  restartNeeded: true,

  config: {
    enabled: true,
    site: aiSites.ChatGPT,
  },
  menu: async ({ getConfig, setConfig }) => {
    const cfg = await getConfig();
    return [
      {
        label: 'AI Service',
        submenu: [aiSites.ChatGPT, aiSites.Gemini].map((s) => ({
          label: s,
          type: 'radio',
          checked: (cfg.site || aiSites.ChatGPT) === s,
          click() {
            setConfig({ site: s as AiSite });
          },
        })),
      },
      {
        label: 'Open website',
        click() {
          getConfig().then(({ site }) => {
            shell.openExternal(urlFor((site as AiSite) || aiSites.ChatGPT));
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
            d="M12 2a10 10 0 0 0-10 10v6a2 2 0 0 0 2 2h2v-6H4v-2a8 8 0 0 1 16 0v2h-2v6h2a2 2 0 0 0 2-2v-6a10 10 0 0 0-10-10z"/>
          <rect x="6" y="14" width="2" height="6" rx="1" fill="currentColor"/>
          <rect x="16" y="14" width="2" height="6" rx="1" fill="currentColor"/>
        </svg>
      `;

      const urlFromConfig = async () => {
        try {
          const { site } = await getConfig<Config>();
          return urlFor(site || aiSites.ChatGPT);
        } catch {
          return urlFor(aiSites.ChatGPT);
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

      const makeButton = () => {
        const btn = document.createElement('button');
        btn.id = 'ai-launcher-btn';
        btn.title = 'Open AI (ChatGPT/Gemini)';
        btn.classList.add('style-scope', 'ytmusic-player-bar');
        btn.innerHTML = ICON_SVG;

        Object.assign(btn.style, {
          width: '40px',
          height: '40px',
          background: 'transparent',
          border: 'none',
          color: 'var(--yt-spec-text-primary,#fff)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          cursor: 'pointer',
        });

        btn.addEventListener(
          'mouseenter',
          () => (btn.style.backgroundColor = 'rgba(255,255,255,0.08)'),
        );
        btn.addEventListener(
          'mouseleave',
          () => (btn.style.backgroundColor = 'transparent'),
        );

        btn.addEventListener('click', async () => {
          const url = await urlFromConfig();
          window.open(url, '_blank', 'noopener,noreferrer');
        });

        return btn;
      };

      const inject = () => {
        const menu = document.getElementById('music-tools-menu');
        const right = findRightControls();
        if (!menu && !right) return false;

        if (document.getElementById('ai-launcher-btn')) return true;

        const btn = makeButton();

        if (menu) {
          menu.appendChild(btn);
        } else if (right) {
          right.appendChild(btn);
        }
        return true;
      };

      inject();
      const poll = setInterval(inject, 800);
      setTimeout(() => clearInterval(poll), 12000);
    },
  },
});
