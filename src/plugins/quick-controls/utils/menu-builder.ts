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

/**
 * 菜单构建器实现类
 * 提供跨平台统一的菜单项生成逻辑
 */
export class MenuBuilder implements IMenuBuilder {
  private songControls: ReturnType<typeof getSongControls>;

  constructor(window: BrowserWindow) {
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
      console.error(`[MenuBuilder] 获取系统文本失败:`, error);
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
      enabled: true
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
   * 包括喜欢按钮等高级功能
   */
  async buildAdvancedControls(): Promise<MenuItemConfig[]> {
    const controls: MenuItemConfig[] = [];

    controls.push({
      id: 'separator1',
      label: '',
      action: () => {},
      separator: true
    });

    controls.push({
      id: 'like',
      label: await this.getSystemText('plugins.quick-controls.controls.like'),
      action: () => {
        this.songControls.like();
      },
      enabled: true
    });

    return controls;
  }

  /**
   * 构建完整菜单
   * 根据配置决定显示哪些菜单项
   */
  async buildFullMenu(state: PlayerState, config: QuickControlsConfig): Promise<MenuItemConfig[]> {
    const menuItems: MenuItemConfig[] = [];

    if (config.showPlaybackControls) {
      const playbackControls = await this.buildPlaybackControls(state);
      menuItems.push(...playbackControls);
    }

    const advancedItems: MenuItemConfig[] = [];
    
    if (config.showLikeButton) {
      const advancedControls = await this.buildAdvancedControls();
 
      for (const item of advancedControls) {
        switch (item.id) {
          case 'separator1':
            advancedItems.push(item);
            break;
            
          case 'like':
            if (config.showLikeButton) {
              advancedItems.push(item);
            }
            break;
            
          default:
            advancedItems.push(item);
            break;
        }
      }
    }

    menuItems.push(...advancedItems);

    return menuItems;
  }


  /**
   * 销毁菜单构建器，清理资源
   */
  destroy(): void {

  }
}