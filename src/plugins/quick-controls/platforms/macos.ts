/**
 * macOS 平台 Dock 菜单实现
 * 使用 Electron app.dock.setMenu() API 为 Dock 图标添加右键快捷菜单
 */

import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import is from 'electron-is';

import { BasePlatformController } from './base';
import { StateManager } from '../utils/state-manager';
import { MenuBuilder } from '../utils/menu-builder';

import type { 
  MenuItemConfig
} from '../types';

/**
 * macOS 平台控制器
 * 实现 macOS Dock 菜单的创建和管理
 */
export class MacOSController extends BasePlatformController {
  private dockMenu: Electron.Menu | null = null;

  /**
   * 获取平台名称
   */
  getPlatformName(): string {
    return 'macOS';
  }

  /**
   * 检查 macOS 平台支持
   */
  isSupported(): boolean {
    return is.macOS() && !!app.dock;
  }

  /**
   * 初始化组件
   * 创建状态管理器和菜单构建器实例
   */
  protected async initializeComponents(): Promise<void> {
    if (!this.window) {
      throw new Error('Window reference not initialized');
    }

    console.log('[macOS] Initializing state manager and menu builder');
    
    this.stateManager = new StateManager(this.window);
  
    this.menuBuilder = new MenuBuilder(this.window);
    
    console.log('[macOS] Components initialization completed');
  }

  /**
   * macOS 平台特定初始化
   * 设置 Dock 相关配置
   */
  protected async platformSpecificInitialize(): Promise<void> {
    try {
      console.log('[macOS] Executing platform-specific initialization');
      
      // 确保 Dock 图标可见 (如果应用隐藏了 Dock 图标)
      if (app.dock && !app.dock.isVisible()) {
        console.log('[macOS] Showing Dock icon to support right-click menu');
        app.dock.show();
      }
      
      console.log('[macOS] Platform initialization completed');
      
    } catch (error) {
      console.error('[macOS] Platform initialization failed:', error);
      throw error;
    }
  }

  /**
   * 创建 macOS Dock 菜单
   * 将通用菜单项配置转换为 Electron Menu 并设置到 Dock
   */
  protected async platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void> {
    try {
      console.log(`[macOS] Creating Dock menu with ${items.length} menu items`);
      
      // 将通用菜单项配置转换为 Electron MenuItemConstructorOptions
      const menuTemplate: MenuItemConstructorOptions[] = items.map(item => 
        this.convertToElectronMenuItem(item)
      );
      
      // 创建菜单实例
      this.dockMenu = Menu.buildFromTemplate(menuTemplate);
      
      // 设置到 Dock
      if (app.dock) {
        app.dock.setMenu(this.dockMenu);
        console.log('[macOS] Dock menu set successfully');
      } else {
        throw new Error('Dock API not available');
      }
      
    } catch (error) {
      console.error('[macOS] Dock menu creation failed:', error);
      throw error;
    }
  }

  /**
   * macOS 平台特定销毁逻辑
   * 清理 Dock 菜单
   */
  protected async platformSpecificDestroy(): Promise<void> {
    try {
      console.log('[macOS] Executing platform-specific cleanup');
      
      if (app.dock) {
        app.dock.setMenu(null as any);
        console.log('[macOS] Dock menu cleared');
      }
      
      this.dockMenu = null;
      
      if (this.stateManager) {
        (this.stateManager as StateManager).destroy();
      }
      
      if (this.menuBuilder) {
        (this.menuBuilder as MenuBuilder).destroy();
      }
      
      console.log('[macOS] Platform cleanup completed');
      
    } catch (error) {
      console.error('[macOS] Platform cleanup failed:', error);
    }
  }

  /**
   * 将通用菜单项配置转换为 Electron MenuItemConstructorOptions
   * 处理 macOS 特定的菜单项属性和样式
   */
  private convertToElectronMenuItem(item: MenuItemConfig): MenuItemConstructorOptions {
    if (item.separator) {
      return { type: 'separator' };
    }

    const menuItem: MenuItemConstructorOptions = {
      label: item.label,
      enabled: item.enabled !== false, 
      click: () => {
        try {
          console.log(`[macOS] Executing menu item action: ${item.id}`);
          item.action();
        } catch (error) {
          console.error(`[macOS] Menu item action failed (${item.id}):`, error);
        }
      }
    };

    if (item.checked !== undefined) {
      menuItem.type = 'checkbox';
      menuItem.checked = item.checked;
    }

   
    if (item.id) {
      switch (item.id) {
        case 'playPause':
          break;
          
        case 'previous':
        case 'next':
          break;
          
        case 'like':
          menuItem.accelerator = 'Cmd+L';
          break;
      }
    }

    return menuItem;
  }

  /**
   * 刷新 Dock 菜单
   * macOS 特定的菜单刷新逻辑
   */
  async refreshDockMenu(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('[macOS] 控制器未初始化，无法刷新 Dock 菜单');
      return;
    }

    try {
      console.log('[macOS] 刷新 Dock 菜单');
      await this.refreshMenu();
    } catch (error) {
      console.error('[macOS] 刷新 Dock 菜单失败:', error);
    }
  }

  /**
   * 检查 Dock 图标是否可见
   */
  isDockVisible(): boolean {
    return app.dock ? app.dock.isVisible() : false;
  }

  /**
   * 设置 Dock 图标可见性
   */
  setDockVisibility(visible: boolean): void {
    if (!app.dock) {
      console.warn('[macOS] Dock API 不可用');
      return;
    }

    try {
      if (visible) {
        app.dock.show();
      } else {
        app.dock.hide();
      }
    } catch (error) {
    }
  }

  /**
   * 获取当前 Dock 菜单项数量
   */
  getDockMenuItemCount(): number {
    return this.dockMenu ? this.dockMenu.items.length : 0;
  }
}