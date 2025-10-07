import { createPlugin } from '@/utils';

const aiSites = {
  ChatGPT: 'ChatGPT',
  Gemini: 'Gemini',
} as const;

type AiSite = typeof aiSites[keyof typeof aiSites];

interface Config {
  enabled: boolean;
  site: AiSite;
}

export default createPlugin<unknown, unknown, unknown, Config>({
  name: () => 'Listen with AI',
  description: () => 'Open ChatGPT or Gemini based on your menu choice.',
  restartNeeded: true,

  config: {
    enabled: true,
    site: aiSites.ChatGPT,
  },
});
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
          const { shell } = require('electron') as typeof import('electron');
          shell.openExternal(
            site === aiSites.Gemini
              ? 'https://gemini.google.com/'
              : 'https://chat.openai.com/'
          );
        });
      },
    },
  ];
},