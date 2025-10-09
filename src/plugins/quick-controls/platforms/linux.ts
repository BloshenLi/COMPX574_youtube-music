// Linux system tray menu implementation
import { app, Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import is from 'electron-is';
import * as path from 'path';
import { t } from '@/i18n';

import { BasePlatformController } from './base';
import { StateManager } from '../utils/state-manager';
import { MenuBuilder } from '../utils/menu-builder';

import type { MenuItemConfig } from '../types';

export class LinuxController extends BasePlatformController {
  private tray: Tray | null = null;
  private trayMenu: Electron.Menu | null = null;

  getPlatformName(): string {
    return 'Linux';
  }

  isSupported(): boolean {
    return is.linux();
  }

  protected async initializeComponents(): Promise<void> {
    if (!this.window) {
      throw new Error('Window reference not initialized');
    }

    console.log('[Linux] Initializing state manager and menu builder');

    this.stateManager = new StateManager(this.window);
    this.menuBuilder = new MenuBuilder(this.window);

    (this.stateManager as StateManager).setMenuRefreshCallback(() => {
      this.refreshTrayMenu();
    });

    console.log('[Linux] Components initialization completed');
  }

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

  private async createTrayIcon(): Promise<void> {
    try {
      const iconPath = this.getTrayIconPath();
      const icon = nativeImage.createFromPath(iconPath);

      if (icon.isEmpty()) {
        console.warn('[Linux] Tray icon not found, creating default red YouTube Music icon');
        const defaultIconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAANxSURBVFhH7ZdLaBNBFIYnbYo1aqMiKCKIChYVwQcqvhBBUVBwIYILQVy4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLgRBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEAT/gP8ApFUjTwAAAABJRU5ErkJggg==';
        const defaultIcon = nativeImage.createFromDataURL(defaultIconData);
        this.tray = new Tray(defaultIcon);
      } else {
        this.tray = new Tray(icon);
      }

      this.tray.setToolTip(t('plugins.quick-controls.platform.tray-tooltip') || 'YouTube Music - Quick Controls');

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

  private getTrayIconPath(): string {
    const fs = require('fs');

    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'assets', 'youtube-music-tray.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'generated', 'icons', 'png', 'icon.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'youtube-music.png'),
      path.join(process.cwd(), 'assets', 'youtube-music-tray.png'),
      path.join(process.cwd(), 'assets', 'youtube-music.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'hicolor', '32x32', 'apps', 'youtube-music.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'hicolor', '24x24', 'apps', 'youtube-music.png'),
    ];

    for (const iconPath of possiblePaths) {
      try {
        if (fs.existsSync(iconPath)) {
          return iconPath;
        }
      } catch (error) {
        console.warn(`[Linux] Error checking path ${iconPath}:`, error);
      }
    }

    console.warn('[Linux] No tray icon found, using default path');
    return possiblePaths[0];
  }

  protected async platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void> {
    try {
      console.log(`[Linux] Creating tray menu with ${items.length} menu items`);

      const likeItem = items.find(item => item.id === 'like');
      if (likeItem) {
        console.log(`[Linux] Like button state: enabled=${likeItem.enabled}, label="${likeItem.label}"`);
      }

      const menuTemplate: MenuItemConstructorOptions[] = items.map(item =>
        this.convertToElectronMenuItem(item)
      );

      menuTemplate.push(
        { type: 'separator' },
        {
          label: t('plugins.quick-controls.platform.show-window') || 'Show YouTube Music',
          click: () => {
            if (this.window) {
              this.window.show();
              this.window.focus();
            }
          }
        },
        {
          label: t('plugins.quick-controls.platform.exit') || 'Exit',
          click: () => {
            app.quit();
          }
        }
      );

      this.trayMenu = Menu.buildFromTemplate(menuTemplate);

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
          console.log(`[Linux] Executing menu item action: ${item.id}`);
          item.action();
        } catch (error) {
          console.error(`[Linux] Menu item action failed (${item.id}):`, error);
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
}
