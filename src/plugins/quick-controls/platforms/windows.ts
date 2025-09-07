/**
 * Windows 平台系统托盘菜单实现
 * 使用 Electron Tray API 为系统托盘添加右键快捷菜单
 */

import { app, Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import is from 'electron-is';
import * as path from 'path';

import { BasePlatformController } from './base';
import { StateManager } from '../utils/state-manager';
import { MenuBuilder } from '../utils/menu-builder';

import type { 
  MenuItemConfig
} from '../types';

/**
 * Windows 平台控制器
 * 实现 Windows 系统托盘菜单的创建和管理
 */
export class WindowsController extends BasePlatformController {
  private tray: Tray | null = null;
  private trayMenu: Electron.Menu | null = null;

  /**
   * 获取平台名称
   */
  getPlatformName(): string {
    return 'Windows';
  }

  /**
   * 检查 Windows 平台支持
   */
  isSupported(): boolean {
    return is.windows();
  }

  /**
   * 初始化组件
   * 创建状态管理器和菜单构建器实例
   */
  protected async initializeComponents(): Promise<void> {
    if (!this.window) {
      throw new Error('Window reference not initialized');
    }

    console.log('[Windows] Initializing state manager and menu builder');
    
    this.stateManager = new StateManager(this.window);
  
    this.menuBuilder = new MenuBuilder(this.window);
    
    // 设置菜单刷新回调，用于语言更改时刷新托盘菜单
    (this.stateManager as StateManager).setMenuRefreshCallback(() => {
      this.refreshTrayMenu();
    });
    
    console.log('[Windows] Components initialization completed');
  }

  /**
   * Windows 平台特定初始化
   * 设置系统托盘相关配置
   */
  protected async platformSpecificInitialize(): Promise<void> {
    try {
      console.log('[Windows] Executing platform-specific initialization');
      
      await this.createTrayIcon();
      
      console.log('[Windows] Platform initialization completed');
      
    } catch (error) {
      console.error('[Windows] Platform initialization failed:', error);
      throw error;
    }
  }

  /**
   * 创建系统托盘图标
   */
  private async createTrayIcon(): Promise<void> {
    try {
      // 创建托盘图标 - 使用应用图标或默认图标
      const iconPath = this.getTrayIconPath();
      const icon = nativeImage.createFromPath(iconPath);
      
      if (icon.isEmpty()) {
        console.warn('[Windows] Tray icon not found, using default');
        // 如果找不到图标，创建一个简单的默认图标
        const defaultIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        this.tray = new Tray(defaultIcon);
      } else {
        this.tray = new Tray(icon);
      }

      // 设置托盘提示文字
      this.tray.setToolTip('YouTube Music - Quick Controls');
      
      // 设置双击事件 - 显示/隐藏主窗口
      this.tray.on('double-click', () => {
        if (this.window) {
          if (this.window.isVisible()) {
            this.window.hide();
          } else {
            this.window.show();
            this.window.focus();
          }
        }
      });

      console.log('[Windows] System tray icon created successfully');
      
    } catch (error) {
      console.error('[Windows] Failed to create tray icon:', error);
      throw error;
    }
  }

  /**
   * 获取托盘图标路径
   * 尝试多个可能的图标位置
   */
  private getTrayIconPath(): string {
    // 常见的应用图标路径
    const possiblePaths = [
      path.join(process.resourcesPath, 'app', 'assets', 'youtube-music.png'),
      path.join(process.resourcesPath, 'assets', 'youtube-music.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'youtube-music.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'icon.png'),
      path.join(process.cwd(), 'assets', 'youtube-music.png'),
      path.join(process.cwd(), 'assets', 'icon.png'),
    ];

    // 返回第一个存在的路径，或默认路径
    return possiblePaths[0]; // 暂时返回第一个路径，后续可以添加文件存在性检查
  }

  /**
   * 创建 Windows 系统托盘菜单
   * 将通用菜单项配置转换为 Electron Menu 并设置到托盘
   */
  protected async platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void> {
    try {
      console.log(`[Windows] Creating tray menu with ${items.length} menu items`);
      
      // 将通用菜单项配置转换为 Electron MenuItemConstructorOptions
      const menuTemplate: MenuItemConstructorOptions[] = items.map(item => 
        this.convertToElectronMenuItem(item)
      );

      // 添加分隔符和退出选项
      menuTemplate.push(
        { type: 'separator' },
        {
          label: 'Show YouTube Music',
          click: () => {
            if (this.window) {
              this.window.show();
              this.window.focus();
            }
          }
        },
        {
          label: 'Exit',
          click: () => {
            app.quit();
          }
        }
      );
      
      // 创建菜单实例
      this.trayMenu = Menu.buildFromTemplate(menuTemplate);
      
      // 设置到系统托盘
      if (this.tray) {
        this.tray.setContextMenu(this.trayMenu);
        console.log('[Windows] Tray menu set successfully');
      } else {
        throw new Error('Tray not initialized');
      }
      
    } catch (error) {
      console.error('[Windows] Tray menu creation failed:', error);
      throw error;
    }
  }

  /**
   * Windows 平台特定销毁逻辑
   * 清理系统托盘
   */
  protected async platformSpecificDestroy(): Promise<void> {
    try {
      console.log('[Windows] Executing platform-specific cleanup');
      
      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
      }
      
      this.trayMenu = null;
      
      if (this.stateManager) {
        (this.stateManager as StateManager).destroy();
      }
      
      if (this.menuBuilder) {
        (this.menuBuilder as MenuBuilder).destroy();
      }
      
      console.log('[Windows] Platform cleanup completed');
      
    } catch (error) {
      console.error('[Windows] Platform cleanup failed:', error);
    }
  }

  /**
   * 将通用菜单项配置转换为 Electron MenuItemConstructorOptions
   * 处理 Windows 特定的菜单项属性和样式，包括子菜单支持
   */
  private convertToElectronMenuItem(item: MenuItemConfig): MenuItemConstructorOptions {
    if (item.separator) {
      return { type: 'separator' };
    }

    const menuItem: MenuItemConstructorOptions = {
      label: item.label,
      enabled: item.enabled !== false
    };

    // 处理子菜单
    if (item.submenu && item.submenu.length > 0) {
      menuItem.submenu = item.submenu.map(subItem => this.convertToElectronMenuItem(subItem));
    } else {
      // 只有叶子节点才有点击事件
      menuItem.click = () => {
        try {
          console.log(`[Windows] Executing menu item action: ${item.id}`);
          item.action();
        } catch (error) {
          console.error(`[Windows] Menu item action failed (${item.id}):`, error);
        }
      };
    }

    // 设置菜单项类型
    if (item.checked !== undefined) {
      // Repeat 子项使用 radio
      if (item.id?.startsWith('repeat-')) {
        menuItem.type = 'radio';
      } else if (item.id === 'shuffle') {
        // Shuffle 使用 checkbox
        menuItem.type = 'checkbox';
      }
      menuItem.checked = item.checked;
    }

    // Windows 平台的快捷键设置
    if (item.id) {
      switch (item.id) {
        case 'playPause':
          menuItem.accelerator = 'Space';
          break;
          
        case 'previous':
          menuItem.accelerator = 'Ctrl+Left';
          break;
          
        case 'next':
          menuItem.accelerator = 'Ctrl+Right';
          break;
          
        case 'like':
          menuItem.accelerator = 'Ctrl+L';
          break;
      }
    }

    return menuItem;
  }

  /**
   * 刷新系统托盘菜单
   * Windows 特定的菜单刷新逻辑
   */
  async refreshTrayMenu(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('[Windows] Controller not initialized, cannot refresh tray menu');
      return;
    }

    try {
      console.log('[Windows] Refreshing system tray menu');
      await this.refreshMenu();
    } catch (error) {
      console.error('[Windows] Failed to refresh system tray menu:', error);
    }
  }

  /**
   * 检查系统托盘是否已创建
   */
  isTrayCreated(): boolean {
    return this.tray !== null;
  }

  /**
   * 更新托盘图标
   * 可用于根据播放状态更改图标
   */
  updateTrayIcon(iconPath?: string): void {
    if (!this.tray) {
      console.warn('[Windows] Tray not initialized');
      return;
    }

    try {
      const path = iconPath || this.getTrayIconPath();
      const icon = nativeImage.createFromPath(path);
      
      if (!icon.isEmpty()) {
        this.tray.setImage(icon);
      }
    } catch (error) {
      console.error('[Windows] Failed to update tray icon:', error);
    }
  }

  /**
   * 设置托盘提示文字
   */
  setTrayTooltip(tooltip: string): void {
    if (this.tray) {
      this.tray.setToolTip(tooltip);
    }
  }

  /**
   * 获取当前托盘菜单项数量
   */
  getTrayMenuItemCount(): number {
    return this.trayMenu ? this.trayMenu.items.length : 0;
  }
}