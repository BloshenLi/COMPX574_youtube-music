// macOS Dock menu implementation
import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import is from 'electron-is';

import { BasePlatformController } from './base';
import { StateManager } from '../utils/state-manager';
import { MenuBuilder } from '../utils/menu-builder';

import type { MenuItemConfig } from '../types';

export class MacOSController extends BasePlatformController {
  private dockMenu: Electron.Menu | null = null;

  getPlatformName(): string {
    return 'macOS';
  }

  isSupported(): boolean {
    return is.macOS() && !!app.dock;
  }

  protected async initializeComponents(): Promise<void> {
    if (!this.window) {
      throw new Error('Window reference not initialized');
    }

    console.log('[macOS] Initializing state manager and menu builder');
    this.stateManager = new StateManager(this.window);
    this.menuBuilder = new MenuBuilder(this.window);
    console.log('[macOS] Components initialization completed');
  }

  protected async platformSpecificInitialize(): Promise<void> {
    try {
      console.log('[macOS] Executing platform-specific initialization');

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

  protected async platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void> {
    try {
      console.log(`[macOS] Creating Dock menu with ${items.length} menu items`);

      const menuTemplate: MenuItemConstructorOptions[] = items.map(item =>
        this.convertToElectronMenuItem(item)
      );

      this.dockMenu = Menu.buildFromTemplate(menuTemplate);

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

  private convertToElectronMenuItem(item: MenuItemConfig): MenuItemConstructorOptions {
    if (item.separator) {
      return { type: 'separator' };
    }

    const menuItem: MenuItemConstructorOptions = {
      label: item.label,
      enabled: item.enabled !== false
    };

    if (item.submenu && item.submenu.length > 0) {
      menuItem.submenu = item.submenu.map(subItem => this.convertToElectronMenuItem(subItem));
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

    if (item.id) {
      switch (item.id) {
        case 'playPause':
          menuItem.accelerator = 'Space';
          break;

        case 'previous':
          menuItem.accelerator = 'Cmd+Left';
          break;

        case 'next':
          menuItem.accelerator = 'Cmd+Right';
          break;

        case 'like':
          menuItem.accelerator = 'Cmd+L';
          break;
      }
    }

    return menuItem;
  }
}
