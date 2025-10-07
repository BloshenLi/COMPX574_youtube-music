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

const urlFor = (s: AiSite) =>
  s === aiSites.Gemini ? 'https://gemini.google.com/' : 'https://chat.openai.com/';

export default createPlugin<unknown, unknown, unknown, Config>({
  name: () => 'Listen with AI',
  description: () => 'Open ChatGPT or Gemini based on your menu choice.',
  restartNeeded: true,

  config: {
    enabled: true,
    site: aiSites.ChatGPT,
  },
});