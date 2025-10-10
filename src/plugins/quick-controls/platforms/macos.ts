// macOS Dock menu implementation
import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import is from 'electron-is';

import { MenuBuilder } from '../utils/menu-builder';
import { StateManager } from '../utils/state-manager';
import type { MenuItemConfig } from '../types';

import { BasePlatformController } from './base';

export class MacOSController extends BasePlatformController {
  private dockMenu: Electron.Menu | null = null;

  getPlatformName(): string {
    return 'macOS';
  }

  isSupported(): boolean {
    return is.macOS() && !!app.dock;
  }

  protected initializeComponents(): Promise<void> {
    if (!this.window) {
      throw new Error('Window reference not initialized');
    }

    console.log('[macOS] Initializing state manager and menu builder');
    this.stateManager = new StateManager(this.window);
    this.menuBuilder = new MenuBuilder(this.window);
    console.log('[macOS] Components initialization completed');
    return Promise.resolve();
  }

  protected platformSpecificInitialize(): Promise<void> {
    try {
      console.log('[macOS] Executing platform-specific initialization');

      if (app.dock && !app.dock.isVisible()) {
        console.log('[macOS] Showing Dock icon to support right-click menu');
        app.dock.show();
      }

      console.log('[macOS] Platform initialization completed');
      return Promise.resolve();
    } catch (error) {
      console.error('[macOS] Platform initialization failed:', error);
      throw error;
    }
  }

  protected platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void> {
    try {
      console.log(`[macOS] Creating Dock menu with ${items.length} menu items`);

      const menuTemplate: MenuItemConstructorOptions[] = items.map((item) =>
        this.convertToElectronMenuItem(item),
      );

      this.dockMenu = Menu.buildFromTemplate(menuTemplate);

      if (app.dock) {
        app.dock.setMenu(this.dockMenu);
        console.log('[macOS] Dock menu set successfully');
      } else {
        throw new Error('Dock API not available');
      }
      return Promise.resolve();
    } catch (error) {
      console.error('[macOS] Dock menu creation failed:', error);
      throw error;
    }
  }

  protected platformSpecificDestroy(): Promise<void> {
    try {
      console.log('[macOS] Executing platform-specific cleanup');

      if (app.dock) {
        app.dock.setMenu(Menu.buildFromTemplate([]));
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
      return Promise.resolve();
    } catch (error) {
      console.error('[macOS] Platform cleanup failed:', error);
      throw error;
    }
  }

  private convertToElectronMenuItem(
    item: MenuItemConfig,
  ): MenuItemConstructorOptions {
    if (item.separator) {
      return { type: 'separator' };
    }

    const menuItem: MenuItemConstructorOptions = {
      label: item.label,
      enabled: item.enabled !== false,
    };

    if (item.submenu && item.submenu.length > 0) {
      menuItem.submenu = item.submenu.map((subItem) =>
        this.convertToElectronMenuItem(subItem),
      );
    } else {
      menuItem.click = () => {
        try {
          console.log(`[macOS] Executing menu item action: ${item.id}`);
          item.action();
        } catch (error) {
          console.error(`[macOS] Menu item action failed (${item.id}):`, error);
        }
      };
    }

    if (item.checked !== undefined) {
      if (item.id?.startsWith('repeat-')) {
        menuItem.type = 'radio';
      } else if (item.id === 'shuffle') {
        menuItem.type = 'checkbox';
      }
      menuItem.checked = item.checked;
    }

    return menuItem;
  }
}
