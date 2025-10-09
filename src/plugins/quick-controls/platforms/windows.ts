// Windows system tray menu implementation
import { app, Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import is from 'electron-is';
import * as path from 'path';
import { t } from '@/i18n';

import { BasePlatformController } from './base';
import { StateManager } from '../utils/state-manager';
import { MenuBuilder } from '../utils/menu-builder';

import type { MenuItemConfig } from '../types';

export class WindowsController extends BasePlatformController {
  private tray: Tray | null = null;
  private trayMenu: Electron.Menu | null = null;

  getPlatformName(): string {
    return 'Windows';
  }

  isSupported(): boolean {
    return is.windows();
  }

  protected async initializeComponents(): Promise<void> {
    if (!this.window) {
      throw new Error('Window reference not initialized');
    }

    console.log('[Windows] Initializing state manager and menu builder');

    this.stateManager = new StateManager(this.window);
    this.menuBuilder = new MenuBuilder(this.window);

    (this.stateManager as StateManager).setMenuRefreshCallback(() => {
      this.refreshTrayMenu();
    });

    console.log('[Windows] Components initialization completed');
  }

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

  private async createTrayIcon(): Promise<void> {
    try {
      const iconPath = this.getTrayIconPath();
      const icon = nativeImage.createFromPath(iconPath);

      if (icon.isEmpty()) {
        console.warn('[Windows] Tray icon not found, creating default red YouTube Music icon');
        const defaultIconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAANxSURBVFhH7ZdLaBNBFIYnbYo1aqMiKCKIChYVwQcqvhBBUVBwIYILQVy4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLly4cOHChQsXLgRBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEARBEAT/gP8ApFUjTwAAAABJRU5ErkJggg==';
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

      console.log('[Windows] System tray icon created successfully');
    } catch (error) {
      console.error('[Windows] Failed to create tray icon:', error);
      throw error;
    }
  }

  private getTrayIconPath(): string {
    const fs = require('fs');

    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'assets', 'youtube-music-tray.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'generated', 'icons', 'win', 'icon.ico'),
      path.join(__dirname, '..', '..', '..', 'assets', 'youtube-music.png'),
      path.join(process.cwd(), 'assets', 'youtube-music-tray.png'),
      path.join(process.cwd(), 'assets', 'youtube-music.png'),
    ];

    for (const iconPath of possiblePaths) {
      try {
        if (fs.existsSync(iconPath)) {
          return iconPath;
        }
      } catch (error) {
        console.warn(`[Windows] Error checking path ${iconPath}:`, error);
      }
    }

    console.warn('[Windows] No tray icon found, using default path');
    return possiblePaths[0];
  }

  protected async platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void> {
    try {
      console.log(`[Windows] Creating tray menu with ${items.length} menu items`);

      const likeItem = items.find(item => item.id === 'like');
      if (likeItem) {
        console.log(`[Windows] Like button state: enabled=${likeItem.enabled}, label="${likeItem.label}"`);
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
        console.log('[Windows] Tray menu set successfully');
      } else {
        throw new Error('Tray not initialized');
      }
    } catch (error) {
      console.error('[Windows] Tray menu creation failed:', error);
      throw error;
    }
  }

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
          console.log(`[Windows] Executing menu item action: ${item.id}`);
          item.action();
        } catch (error) {
          console.error(`[Windows] Menu item action failed (${item.id}):`, error);
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
}
