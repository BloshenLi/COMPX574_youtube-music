import { createPlugin } from '@/utils';
import backend from './backend';
import renderer from './renderer';

export default createPlugin({
  name: () => 'Lyrics Console',
  description: () => 'Floating synced lyrics',
  backend,
  renderer,
});
