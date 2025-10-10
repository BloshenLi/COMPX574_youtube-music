// Menu builder for creating standardized menu items
import { t } from '@/i18n';
import { getSongControls } from '@/providers/song-controls';

import { RepeatMode } from '../types';

import type {
  IMenuBuilder,
  MenuItemConfig,
  PlayerState,
  QuickControlsConfig,
} from '../types';
import type { BrowserWindow } from 'electron';

export class MenuBuilder implements IMenuBuilder {
  private songControls: ReturnType<typeof getSongControls>;
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.songControls = getSongControls(window);
  }

  private getLocalizedText(key: string): string {
    return t(key);
  }

  buildPlaybackControls(state: PlayerState): MenuItemConfig[] {
    const controls: MenuItemConfig[] = [];

    const playPauseLabel = state.isPlaying
      ? this.getLocalizedText('plugins.quick-controls.controls.pause')
      : this.getLocalizedText('plugins.quick-controls.controls.play');

    controls.push({
      id: 'playPause',
      label: playPauseLabel,
      action: () => {
        this.songControls.playPause();
      },
      enabled: true,
    });

    controls.push({
      id: 'previous',
      label: this.getLocalizedText('plugins.quick-controls.controls.previous'),
      action: () => {
        this.songControls.previous();
      },
      enabled: !state.isPaused,
    });

    controls.push({
      id: 'next',
      label: this.getLocalizedText('plugins.quick-controls.controls.next'),
      action: () => {
        this.songControls.next();
      },
      enabled: true,
    });

    return controls;
  }

  buildAdvancedControls(state: PlayerState): MenuItemConfig[] {
    const controls: MenuItemConfig[] = [];

    controls.push({
      id: 'separator1',
      label: '',
      action: () => {},
      separator: true,
    });

    const likeLabel = state.isLiked
      ? this.getLocalizedText('plugins.quick-controls.controls.unlike')
      : this.getLocalizedText('plugins.quick-controls.controls.like');

    console.log('[MenuBuilder] Building like menu item:');
    console.log(
      `[MenuBuilder] State: isLiked=${state.isLiked}, canLike=${state.canLike}, hasCurrentSong=${state.hasCurrentSong}`,
    );
    console.log(
      `[MenuBuilder] Label: "${likeLabel}" ${state.isLiked ? '❤️' : '🤍'}`,
    );

    controls.push({
      id: 'like',
      label: likeLabel,
      action: () => {
        console.log(
          `[MenuBuilder] Like menu item clicked, current state: isLiked=${state.isLiked}`,
        );
        this.songControls.like();
        setTimeout(() => {
          this.requestLikeStateRefresh();
        }, 300);
      },
      enabled: state.canLike && state.hasCurrentSong,
    });

    controls.push({
      id: 'shuffle',
      label: this.getLocalizedText('plugins.quick-controls.controls.shuffle'),
      action: () => {
        this.songControls.shuffle();
        setTimeout(() => {
          this.requestShuffleStateRefresh();
        }, 800);
      },
      enabled: !state.isPaused,
      checked: state.isShuffled,
    });

    controls.push({
      id: 'repeat',
      label: this.getLocalizedText(
        'plugins.quick-controls.controls.repeat-mode',
      ),
      action: () => {},
      enabled: !state.isPaused,
      submenu: [
        {
          id: 'repeat-off',
          label: this.getLocalizedText(
            'plugins.quick-controls.repeat.label.off',
          ),
          action: () => {
            if (state.repeatMode !== RepeatMode.OFF) {
              let switches = 0;
              if (state.repeatMode === RepeatMode.ALL) {
                switches = 2;
              } else if (state.repeatMode === RepeatMode.ONE) {
                switches = 1;
              }
              if (switches > 0) {
                this.songControls.switchRepeat(switches);
                setTimeout(() => {
                  this.requestRepeatStateRefresh();
                }, 800);
              }
            }
          },
          enabled: true,
          checked: state.repeatMode === RepeatMode.OFF,
        },
        {
          id: 'repeat-one',
          label: this.getLocalizedText(
            'plugins.quick-controls.repeat.label.one',
          ),
          action: () => {
            if (state.repeatMode !== RepeatMode.ONE) {
              let switches = 0;
              if (state.repeatMode === RepeatMode.OFF) {
                switches = 2;
              } else if (state.repeatMode === RepeatMode.ALL) {
                switches = 1;
              }
              if (switches > 0) {
                this.songControls.switchRepeat(switches);
                setTimeout(() => {
                  this.requestRepeatStateRefresh();
                }, 800);
              }
            }
          },
          enabled: true,
          checked: state.repeatMode === RepeatMode.ONE,
        },
        {
          id: 'repeat-all',
          label: this.getLocalizedText(
            'plugins.quick-controls.repeat.label.all',
          ),
          action: () => {
            if (state.repeatMode !== RepeatMode.ALL) {
              let switches = 0;
              if (state.repeatMode === RepeatMode.OFF) {
                switches = 1;
              } else if (state.repeatMode === RepeatMode.ONE) {
                switches = 2;
              }
              if (switches > 0) {
                this.songControls.switchRepeat(switches);
                setTimeout(() => {
                  this.requestRepeatStateRefresh();
                }, 800);
              }
            }
          },
          enabled: true,
          checked: state.repeatMode === RepeatMode.ALL,
        },
      ],
    });

    return controls;
  }

  buildFullMenu(
    state: PlayerState,
    config: QuickControlsConfig,
  ): MenuItemConfig[] {
    const menuItems: MenuItemConfig[] = [];

    if (config.showPlaybackControls) {
      const playbackControls = this.buildPlaybackControls(state);
      menuItems.push(...playbackControls);
    }

    const needsAdvancedControls =
      config.showLikeButton ||
      config.showRepeatControl ||
      config.showShuffleControl;

    if (needsAdvancedControls) {
      const advancedControls = this.buildAdvancedControls(state);

      for (const item of advancedControls) {
        switch (item.id) {
          case 'separator1':
            menuItems.push(item);
            break;

          case 'like':
            if (config.showLikeButton) {
              menuItems.push(item);
            }
            break;

          case 'shuffle':
            if (config.showShuffleControl) {
              menuItems.push(item);
            }
            break;

          case 'repeat':
            if (config.showRepeatControl) {
              menuItems.push(item);
            }
            break;

          default:
            menuItems.push(item);
            break;
        }
      }
    }

    return menuItems;
  }

  private requestLikeStateRefresh(): void {
    try {
      this.window.webContents.send('ytmd:refresh-like-status');
    } catch (error) {
      console.error(
        '[MenuBuilder] Failed to request like state refresh:',
        error,
      );
    }
  }

  private requestRepeatStateRefresh(): void {
    try {
      this.window.webContents.send('ytmd:refresh-repeat-status');
    } catch (error) {
      console.error(
        '[MenuBuilder] Failed to request repeat state refresh:',
        error,
      );
    }
  }

  private requestShuffleStateRefresh(): void {
    try {
      this.window.webContents.send('ytmd:refresh-shuffle-status');
    } catch (error) {
      console.error(
        '[MenuBuilder] Failed to request shuffle state refresh:',
        error,
      );
    }
  }

  destroy(): void {}
}
