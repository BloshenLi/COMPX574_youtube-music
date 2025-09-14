/**
 * 菜单构建器
 * 负责根据播放器状态和配置生成标准化的菜单项
 */

import type { BrowserWindow } from 'electron';
import getSongControls from '@/providers/song-controls';
import { t } from '@/i18n';

import type { 
  IMenuBuilder, 
  MenuItemConfig, 
  PlayerState, 
  QuickControlsConfig
} from '../types';
import { RepeatMode } from '../types';

/**
 * 菜单构建器实现类
 * 提供跨平台统一的菜单项生成逻辑
 */
export class MenuBuilder implements IMenuBuilder {
  private songControls: ReturnType<typeof getSongControls>;
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.songControls = getSongControls(window);
  }

  /**
   * 获取本地化文本
   * 使用应用的i18n系统，跟随用户设置的语言
   */
  private getLocalizedText(key: string): string {
    return t(key);
  }


  /**
   * 构建播放控制菜单项
   * 包括播放/暂停、上一首、下一首等基础控制
   */
  async buildPlaybackControls(state: PlayerState): Promise<MenuItemConfig[]> {
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
      enabled: true
    });

    controls.push({
      id: 'previous',
      label: this.getLocalizedText('plugins.quick-controls.controls.previous'),
      action: () => {
        this.songControls.previous();
      },
      enabled: !state.isPaused // 暂停时禁用上一首
    });

 
    controls.push({
      id: 'next',
      label: this.getLocalizedText('plugins.quick-controls.controls.next'),
      action: () => {
        this.songControls.next();
      },
      enabled: true
    });

    return controls;
  }

  /**
   * 构建高级控制菜单项  
   * 包括喜欢按钮、循环播放等高级功能
   */
  async buildAdvancedControls(state: PlayerState): Promise<MenuItemConfig[]> {
    const controls: MenuItemConfig[] = [];

    controls.push({
      id: 'separator1',
      label: '',
      action: () => {},
      separator: true
    });

    // 喜欢/取消喜欢按钮 - 根据当前状态动态切换
    const likeLabel = state.isLiked
      ? this.getLocalizedText('plugins.quick-controls.controls.unlike')
      : this.getLocalizedText('plugins.quick-controls.controls.like');

    console.log(`[MenuBuilder] 🎯 构建Like菜单项:`);
    console.log(`[MenuBuilder] 🎯 状态: isLiked=${state.isLiked}, canLike=${state.canLike}, hasCurrentSong=${state.hasCurrentSong}`);
    console.log(`[MenuBuilder] 🎯 显示文本: "${likeLabel}" ${state.isLiked ? '❤️' : '🤍'}`);

    controls.push({
      id: 'like',
      label: likeLabel,
      action: () => {
        console.log(`[MenuBuilder] Like菜单项被点击，当前状态: isLiked=${state.isLiked}`);
        this.songControls.like();
        // like state refresh
        setTimeout(() => {
          this.requestLikeStateRefresh();
        }, 300);
      },
      enabled: state.canLike && state.hasCurrentSong
    });


    // 循环播放控制 - 带子菜单的设计
    // 随机播放控制 - 使用原生 checkbox 勾选状态
    controls.push({
      id: 'shuffle',
      label: this.getLocalizedText('plugins.quick-controls.controls.shuffle'),
      action: () => {
        this.songControls.shuffle();
        // 刷新状态
        setTimeout(() => {
          this.requestShuffleStateRefresh();
        }, 800);
      },
      enabled: !state.isPaused, // 暂停时禁用随机播放
      checked: state.isShuffled  // 用原生 checkbox 表示是否开启
    });

    // 循环播放控制 - 带子菜单的设计
    controls.push({
      id: 'repeat',
      label: this.getLocalizedText('plugins.quick-controls.controls.repeat-mode'),
      action: () => {}, 
      enabled: !state.isPaused, // 暂停时禁用整个 repeat 菜单
      submenu: [
        {
          id: 'repeat-off',
          label: this.getLocalizedText('plugins.quick-controls.repeat.label.off'),
          action: () => {
            // 设置为关闭模式
            if (state.repeatMode !== RepeatMode.OFF) {
              // 正确的循环顺序：OFF → ALL → ONE → OFF
              let switches = 0;
              if (state.repeatMode === RepeatMode.ALL) {
                switches = 2; // ALL → ONE → OFF
              } else if (state.repeatMode === RepeatMode.ONE) {
                switches = 1; // ONE → OFF
              }
              if (switches > 0) {
                this.songControls.switchRepeat(switches);
                // 刷新状态
                setTimeout(() => {
                  this.requestRepeatStateRefresh();
                }, 800);
              }
            }
          },
          enabled: true,
          checked: state.repeatMode === RepeatMode.OFF
        },
        {
          id: 'repeat-one',
          label: this.getLocalizedText('plugins.quick-controls.repeat.label.one'),
          action: () => {
            // 设置为单曲循环
            if (state.repeatMode !== RepeatMode.ONE) {
              // 正确的循环顺序：OFF → ALL → ONE → OFF
              let switches = 0;
              if (state.repeatMode === RepeatMode.OFF) {
                switches = 2; // OFF → ALL → ONE
              } else if (state.repeatMode === RepeatMode.ALL) {
                switches = 1; // ALL → ONE
              }
              if (switches > 0) {
                this.songControls.switchRepeat(switches);
                // 刷新状态
                setTimeout(() => {
                  this.requestRepeatStateRefresh();
                }, 800);
              }
            }
          },
          enabled: true,
          checked: state.repeatMode === RepeatMode.ONE
        },
        {
          id: 'repeat-all',
          label: this.getLocalizedText('plugins.quick-controls.repeat.label.all'),
          action: () => {
            // 设置为列表循环
            if (state.repeatMode !== RepeatMode.ALL) {
              // 正确的循环顺序：OFF → ALL → ONE → OFF
              let switches = 0;
              if (state.repeatMode === RepeatMode.OFF) {
                switches = 1; // OFF → ALL
              } else if (state.repeatMode === RepeatMode.ONE) {
                switches = 2; // ONE → OFF → ALL
              }
              if (switches > 0) {
                this.songControls.switchRepeat(switches);
                // 刷新状态
                setTimeout(() => {
                  this.requestRepeatStateRefresh();
                }, 800);
              }
            }
          },
          enabled: true,
          checked: state.repeatMode === RepeatMode.ALL
        }
      ]
    });

    return controls;
  }

  /**
   * 构建完整菜单
   * 根据配置决定显示哪些菜单项
   */
  async buildFullMenu(state: PlayerState, config: QuickControlsConfig): Promise<MenuItemConfig[]> {
    const menuItems: MenuItemConfig[] = [];

    // 添加播放控制菜单项
    if (config.showPlaybackControls) {
      const playbackControls = await this.buildPlaybackControls(state);
      menuItems.push(...playbackControls);
    }

    // 检查是否需要显示任何高级控制项
    const needsAdvancedControls = config.showLikeButton || config.showRepeatControl || config.showShuffleControl;
    
    if (needsAdvancedControls) {
      const advancedControls = await this.buildAdvancedControls(state);
      
      for (const item of advancedControls) {
        switch (item.id) {
          case 'separator1':
            // 总是添加分隔符，如果有高级控制项
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


  /**
   * 请求前端刷新like状态
   * 用于在菜单按钮点击后立即更新状态
   */
  private requestLikeStateRefresh(): void {
    try {
      this.window.webContents.send('ytmd:refresh-like-status');
    } catch (error) {
      console.error('[MenuBuilder] Failed to request like state refresh:', error);
    }
  }

  /**
   * 请求前端刷新循环播放状态
   * 用于在菜单按钮点击后立即更新状态
   */
  private requestRepeatStateRefresh(): void {
    try {
      this.window.webContents.send('ytmd:refresh-repeat-status');
    } catch (error) {
      console.error('[MenuBuilder] Failed to request repeat state refresh:', error);
    }
  }

  /**
   * 请求前端刷新随机播放状态
   * 用于在菜单按钮点击后立即更新状态
   */
  private requestShuffleStateRefresh(): void {
    try {
      this.window.webContents.send('ytmd:refresh-shuffle-status');
    } catch (error) {
      console.error('[MenuBuilder] Failed to request shuffle state refresh:', error);
    }
  }

  
  destroy(): void {

  }
}