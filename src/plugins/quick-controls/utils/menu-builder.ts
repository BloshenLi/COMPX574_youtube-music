/**
 * 菜单构建器
 * 负责根据播放器状态和配置生成标准化的菜单项
 */

import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import getSongControls from '@/providers/song-controls';
import { languageResources } from 'virtual:i18n';

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
   * 根据系统语言获取文本
   * 直接使用系统语言设置，而不是应用语言配置
   */
  private async getSystemText(key: string): Promise<string> {
    try {
      const systemLocale = app.getLocale();
      
      // 获取语言资源
      const resources = await languageResources();
      
      // 尝试获取系统语言对应的文本
      const localeResource = resources[systemLocale];
      
      if (localeResource) {
        // 语言资源被包装在 translation 对象中
        const translationData = localeResource.translation || localeResource;
        
        const text = this.getNestedProperty(translationData, key);
        if (text) {
          return text;
        }
      }
      
      // 回退到英文
      const fallbackResource = resources['en'];
      if (fallbackResource) {
        // 英文资源也可能被包装在 translation 对象中
        const translationData = fallbackResource.translation || fallbackResource;
        
        const text = this.getNestedProperty(translationData, key);
        if (text) {
          return text;
        }
      }
      
      // 最后回退到 key 本身
      return key;
      
    } catch (error) {
      return key;
    }
  }

  /**
   * 从嵌套对象中获取属性值
   * 例如: getNestedProperty(obj, 'plugins.quick-controls.controls.play')
   */
  private getNestedProperty(obj: any, path: string): string | null {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }
    
    return typeof current === 'string' ? current : null;
  }

  /**
   * 构建播放控制菜单项
   * 包括播放/暂停、上一首、下一首等基础控制
   */
  async buildPlaybackControls(state: PlayerState): Promise<MenuItemConfig[]> {
    const controls: MenuItemConfig[] = [];

    const playPauseLabel = state.isPlaying 
      ? await this.getSystemText('plugins.quick-controls.controls.pause')
      : await this.getSystemText('plugins.quick-controls.controls.play');
    
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
      label: await this.getSystemText('plugins.quick-controls.controls.previous'),
      action: () => {
        this.songControls.previous();
      },
      enabled: !state.isPaused // 暂停时禁用上一首
    });

 
    controls.push({
      id: 'next',
      label: await this.getSystemText('plugins.quick-controls.controls.next'),
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
      ? await this.getSystemText('plugins.quick-controls.controls.unlike')
      : await this.getSystemText('plugins.quick-controls.controls.like');
    
    controls.push({
      id: 'like',
      label: likeLabel,
      action: () => {
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
      label: await this.getSystemText('plugins.quick-controls.controls.shuffle'),
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
      label: 'Repeat',
      action: () => {}, 
      enabled: !state.isPaused, // 暂停时禁用整个 repeat 菜单
      submenu: [
        {
          id: 'repeat-off',
          label: 'Off',
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
          label: 'One',
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
          label: 'All',
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