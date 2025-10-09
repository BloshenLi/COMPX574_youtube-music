// Base platform controller
import type { BrowserWindow } from 'electron';
import type {
  IPlatformController,
  MenuItemConfig,
  PlayerState,
  QuickControlsConfig,
  IStateManager,
  IMenuBuilder
} from '../types';

export abstract class BasePlatformController implements IPlatformController {
  protected window: BrowserWindow | null = null;
  protected config: QuickControlsConfig | null = null;
  protected stateManager: IStateManager | null = null;
  protected menuBuilder: IMenuBuilder | null = null;
  protected currentState: PlayerState | null = null;
  protected isInitialized: boolean = false;

  async initialize(window: BrowserWindow, config: QuickControlsConfig): Promise<void> {
    try {
      console.log(`[${this.getPlatformName()}] Initializing platform controller`);

      this.window = window;
      this.config = config;

      await this.initializeComponents();
      this.setupStateListeners();
      await this.platformSpecificInitialize();
      this.isInitialized = true;
      await this.refreshMenu();

      console.log(`[${this.getPlatformName()}] Platform controller initialized`);
    } catch (error) {
      console.error(`[${this.getPlatformName()}] Initialization failed:`, error);
      throw error;
    }
  }

  async createMenu(items: MenuItemConfig[]): Promise<void> {
    if (!this.isInitialized) {
      console.warn(`[${this.getPlatformName()}] Controller not initialized, cannot create menu`);
      return;
    }

    try {
      await this.platformSpecificCreateMenu(items);
      console.log(`[${this.getPlatformName()}] Menu updated successfully with ${items.length} items`);
    } catch (error) {
      console.error(`[${this.getPlatformName()}] Menu creation failed:`, error);
      throw error;
    }
  }

  async updatePlayerState(state: PlayerState): Promise<void> {
    try {
      const hasStateChanged = this.hasPlayerStateChanged(state);

      if (!hasStateChanged) {
        console.log(`[${this.getPlatformName()}] No state change detected, skipping menu refresh`);
        return;
      }

      console.log(`[${this.getPlatformName()}] Player state updated:`, {
        isPlaying: state.isPlaying,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
        isLiked: state.isLiked,
        canLike: state.canLike,
        hasCurrentSong: state.hasCurrentSong
      });

      console.log(`[${this.getPlatformName()}] Previous state:`, this.currentState ? {
        isLiked: this.currentState.isLiked,
        canLike: this.currentState.canLike,
        hasCurrentSong: this.currentState.hasCurrentSong
      } : 'null');

      this.currentState = { ...state };
      await this.refreshMenu();
    } catch (error) {
      console.error(`[${this.getPlatformName()}] State update failed:`, error);
    }
  }

  async destroy(): Promise<void> {
    try {
      console.log(`[${this.getPlatformName()}] Destroying platform controller`);

      this.removeStateListeners();
      await this.platformSpecificDestroy();

      this.window = null;
      this.config = null;
      this.currentState = null;
      this.stateManager = null;
      this.menuBuilder = null;
      this.isInitialized = false;

      console.log(`[${this.getPlatformName()}] Platform controller destroyed`);
    } catch (error) {
      console.error(`[${this.getPlatformName()}] Destruction failed:`, error);
    }
  }

  abstract getPlatformName(): string;
  abstract isSupported(): boolean;
  protected abstract platformSpecificInitialize(): Promise<void>;
  protected abstract platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void>;
  protected abstract platformSpecificDestroy(): Promise<void>;
  protected abstract initializeComponents(): Promise<void>;

  protected async refreshMenu(): Promise<void> {
    if (!this.menuBuilder || !this.config) {
      console.warn(`[${this.getPlatformName()}] Menu builder or config not initialized`);
      return;
    }

    try {
      const state = this.currentState || await this.getCurrentPlayerState();

      console.log(`[${this.getPlatformName()}] Refreshing menu with state:`, {
        isLiked: state.isLiked,
        canLike: state.canLike,
        hasCurrentSong: state.hasCurrentSong,
        isPlaying: state.isPlaying
      });

      const menuItems = await this.menuBuilder.buildFullMenu(state, this.config);
      await this.createMenu(menuItems);
    } catch (error) {
      console.error(`[${this.getPlatformName()}] Menu refresh failed:`, error);
    }
  }

  protected setupStateListeners(): void {
    if (!this.stateManager) {
      console.warn(`[${this.getPlatformName()}] State manager not initialized`);
      return;
    }

    this.stateManager.onStateChange((state: PlayerState) => {
      this.updatePlayerState(state);
    });
  }

  protected removeStateListeners(): void {
    console.log(`[${this.getPlatformName()}] Removing state listeners`);
  }

  protected async getCurrentPlayerState(): Promise<PlayerState> {
    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    return await this.stateManager.getCurrentState();
  }

  protected hasPlayerStateChanged(newState: PlayerState): boolean {
    if (!this.currentState) {
      return true;
    }

    return (
      this.currentState.isPlaying !== newState.isPlaying ||
      this.currentState.isPaused !== newState.isPaused ||
      this.currentState.repeatMode !== newState.repeatMode ||
      this.currentState.canLike !== newState.canLike ||
      this.currentState.hasCurrentSong !== newState.hasCurrentSong ||
      this.currentState.isLiked !== newState.isLiked ||
      this.currentState.isShuffled !== newState.isShuffled
    );
  }

  protected checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`${this.getPlatformName()} controller not initialized`);
    }
  }
}
