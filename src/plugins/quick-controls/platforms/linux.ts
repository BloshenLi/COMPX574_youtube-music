/**
 * Linux 平台系统托盘菜单实现
 * 使用 Electron Tray API 为系统托盘添加右键快捷菜单
 * 适配 Linux 桌面环境 (GNOME, KDE, XFCE 等)
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
 * Linux 平台控制器
 * 实现 Linux 系统托盘菜单的创建和管理
 */
export class LinuxController extends BasePlatformController {
  private tray: Tray | null = null;
  private trayMenu: Electron.Menu | null = null;

  /**
   * 获取平台名称
   */
  getPlatformName(): string {
    return 'Linux';
  }

  /**
   * 检查 Linux 平台支持
   */
  isSupported(): boolean {
    return is.linux();
  }

  /**
   * 初始化组件
   * 创建状态管理器和菜单构建器实例
   */
  protected async initializeComponents(): Promise<void> {
    if (!this.window) {
      throw new Error('Window reference not initialized');
    }

    console.log('[Linux] Initializing state manager and menu builder');

    this.stateManager = new StateManager(this.window);

    this.menuBuilder = new MenuBuilder(this.window);

    // 设置菜单刷新回调，用于语言更改时刷新托盘菜单
    (this.stateManager as StateManager).setMenuRefreshCallback(() => {
      this.refreshTrayMenu();
    });

    console.log('[Linux] Components initialization completed');
  }

  /**
   * Linux 平台特定初始化
   * 设置系统托盘相关配置
   */
  protected async platformSpecificInitialize(): Promise<void> {
    try {
      console.log('[Linux] Executing platform-specific initialization');

      await this.createTrayIcon();

      console.log('[Linux] Platform initialization completed');

    } catch (error) {
      console.error('[Linux] Platform initialization failed:', error);
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
        console.warn('[Linux] Tray icon not found, creating default red YouTube Music icon');
        // 创建一个红色圆形的 YouTube Music 图标作为默认
        const defaultIconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAANxSURBVFhH7ZdLaBNBFIYnbYo1aqMiKCKIChYVwQcqvhBBUVBwIYILQVy4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLgRBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEAT/gP8ApFUjTwAAAABJRU5ErkJggg==';
        const defaultIcon = nativeImage.createFromDataURL(defaultIconData);
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

      // Linux 特有：处理单击事件（某些桌面环境中，单击也会触发菜单）
      this.tray.on('click', () => {
        if (this.window && !this.window.isVisible()) {
          this.window.show();
          this.window.focus();
        }
      });

      console.log('[Linux] System tray icon created successfully');

    } catch (error) {
      console.error('[Linux] Failed to create tray icon:', error);
      throw error;
    }
  }

  /**
   * 获取托盘图标路径
   * 尝试多个可能的图标位置，优先考虑 Linux 友好的格式
   */
  private getTrayIconPath(): string {
    const fs = require('fs');

    // Linux 桌面环境通常更偏好 PNG 格式的图标
    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'assets', 'youtube-music-tray.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'generated', 'icons', 'png', 'icon.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'youtube-music.png'),
      path.join(process.cwd(), 'assets', 'youtube-music-tray.png'),
      path.join(process.cwd(), 'assets', 'youtube-music.png'),
      // 添加一些 Linux 常见的图标路径
      path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'hicolor', '32x32', 'apps', 'youtube-music.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'hicolor', '24x24', 'apps', 'youtube-music.png'),
    ];

    // 返回第一个存在的路径
    for (const iconPath of possiblePaths) {
      try {
        if (fs.existsSync(iconPath)) {
          return iconPath;
        }
      } catch (error) {
        console.warn(`[Linux] Error checking path ${iconPath}:`, error);
      }
    }

    // 如果都找不到，返回第一个路径作为默认
    console.warn('[Linux] No tray icon found, using default path');
    return possiblePaths[0];
  }

  /**
   * 创建 Linux 系统托盘菜单
   * 将通用菜单项配置转换为 Electron Menu 并设置到托盘
   */
  protected async platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void> {
    try {
      console.log(`[Linux] Creating tray menu with ${items.length} menu items`);

      // Debug: Print key menu item states
      const likeItem = items.find(item => item.id === 'like');
      if (likeItem) {
        console.log(`[Linux] Like button state: enabled=${likeItem.enabled}, label="${likeItem.label}"`);
      }

      // 将通用菜单项配置转换为 Electron MenuItemConstructorOptions
      const menuTemplate: MenuItemConstructorOptions[] = items.map(item =>
        this.convertToElectronMenuItem(item)
      );

      // 添加分隔符和 Linux 特定选项
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
        console.log('[Linux] Tray menu set successfully');
      } else {
        throw new Error('Tray not initialized');
      }

    } catch (error) {
      console.error('[Linux] Tray menu creation failed:', error);
      throw error;
    }
  }

  /**
   * Linux 平台特定销毁逻辑
   * 清理系统托盘
   */
  protected async platformSpecificDestroy(): Promise<void> {
    try {
      console.log('[Linux] Executing platform-specific cleanup');

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

      console.log('[Linux] Platform cleanup completed');

    } catch (error) {
      console.error('[Linux] Platform cleanup failed:', error);
    }
  }

  /**
   * 将通用菜单项配置转换为 Electron MenuItemConstructorOptions
   * 处理 Linux 特定的菜单项属性和样式，包括子菜单支持
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
          console.log(`[Linux] Executing menu item action: ${item.id}`);
          item.action();
        } catch (error) {
          console.error(`[Linux] Menu item action failed (${item.id}):`, error);
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

    // Linux 平台的快捷键设置（类似 Windows，但使用 Ctrl）
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
   * Linux 特定的菜单刷新逻辑
   */
  async refreshTrayMenu(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('[Linux] Controller not initialized, cannot refresh tray menu');
      return;
    }

    try {
      console.log('[Linux] Refreshing system tray menu');
      await this.refreshMenu();
    } catch (error) {
      console.error('[Linux] Failed to refresh system tray menu:', error);
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
      console.warn('[Linux] Tray not initialized');
      return;
    }

    try {
      const path = iconPath || this.getTrayIconPath();
      const icon = nativeImage.createFromPath(path);

      if (!icon.isEmpty()) {
        this.tray.setImage(icon);
      }
    } catch (error) {
      console.error('[Linux] Failed to update tray icon:', error);
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

  /**
   * 检查当前桌面环境是否支持系统托盘
   * Linux 桌面环境对系统托盘的支持可能有所不同
   */
  isSystemTraySupported(): boolean {
    // 在 Linux 中，大多数桌面环境都支持系统托盘
    // GNOME Shell 需要额外的扩展，但我们仍然尝试创建
    return true;
  }

  /**
   * 获取当前桌面环境信息（如果可用）
   */
  getDesktopEnvironment(): string {
    const env = process.env;

    if (env.GNOME_DESKTOP_SESSION_ID || env.GNOME_SHELL_SESSION_MODE) {
      return 'GNOME';
    } else if (env.KDE_SESSION_VERSION || env.KDE_FULL_SESSION) {
      return 'KDE';
    } else if (env.DESKTOP_SESSION?.toLowerCase().includes('xfce')) {
      return 'XFCE';
    } else if (env.DESKTOP_SESSION?.toLowerCase().includes('lxde')) {
      return 'LXDE';
    } else if (env.DESKTOP_SESSION?.toLowerCase().includes('mate')) {
      return 'MATE';
    } else {
      return env.DESKTOP_SESSION || 'Unknown';
    }
  }
}