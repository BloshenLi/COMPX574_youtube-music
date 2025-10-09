import { createPlugin } from '@/utils';
import style from './style.css?inline';

const COLOR_KEY = '--ytmusic-custom-background-color';

const COLORS = [
  'lightpink',
  'pink',
  'crimson',
  'hotpink',
  'deeppink',
  'palevioletred',
  'mediumvioletred',
  'coral',
  'tomato',
  'orange',
  'gold',
  'greenyellow',
  'chartreuse',
  'limegreen',
  'mediumspringgreen',
  'turquoise',
  'dodgerblue',
  'royalblue',
  'blueviolet',
  'orchid',
];

interface PluginConfig {
  enabled: boolean;
  selectedColor: string;
}

export default createPlugin<
  unknown,
  unknown,
  { updateColor(config: PluginConfig): void },
  PluginConfig
>({
  name: () => 'Color Switcher',
  description: () => 'Switch background color of YouTube Music',
  restartNeeded: false,
  config: {
    enabled: true,
    selectedColor: COLORS[0],
  },
  stylesheets: [style],
  menu: async ({ getConfig, setConfig }) => {
    const config = await getConfig();
    return [
      {
        label: 'Choose Background Color',
        submenu: COLORS.map((color) => ({
          label: color,
          type: 'radio' as const,
          checked: config.selectedColor === color,
          click() {
            setConfig({ selectedColor: color });
          },
        })),
      },
    ];
  },
  renderer: {
    updateColor(config: PluginConfig) {
      document.documentElement.style.setProperty(
        COLOR_KEY,
        config.selectedColor,
        'important'
      );
      document.body.style.backgroundColor = `var(${COLOR_KEY})`;
    },
    async start({ getConfig }) {
      const config = await getConfig();
      this.updateColor(config);
    },
    onConfigChange(config: PluginConfig) {
      this.updateColor(config);
    },
  },
});
