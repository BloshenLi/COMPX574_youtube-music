/**
 * 平台控制器抽象基类
 * 定义跨平台快速控制功能的统一接口和通用逻辑
 */

import type { BrowserWindow } from 'electron';
import type { 
  IPlatformController, 
  MenuItemConfig, 
  PlayerState, 
  QuickControlsConfig,
  IStateManager,
  IMenuBuilder
} from '../types';

/**
 * 抽象平台控制器基类
 * 提供通用的生命周期管理和状态处理逻辑
 */
export abstract class BasePlatformController implements IPlatformController {
  protected window: BrowserWindow | null = null;
  protected config: QuickControlsConfig | null = null;
  protected stateManager: IStateManager | null = null;
  protected menuBuilder: IMenuBuilder | null = null;
  protected currentState: PlayerState | null = null;
  protected isInitialized: boolean = false;

  /**
   * 通用初始化逻辑
   * 子类可以重写此方法添加平台特定的初始化代码
   */
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

  /**
   * 创建或更新菜单
   * 根据当前播放器状态和配置生成菜单项
   */
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

  /**
   * 更新播放器状态
   * 当播放器状态发生变化时调用此方法
   */
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

      this.currentState = { ...state };

      await this.refreshMenu();

    } catch (error) {
      console.error(`[${this.getPlatformName()}] State update failed:`, error);
    }
  }

  /**
   * 销毁控制器，清理资源
   */
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

  /**
   * 获取平台名称 (抽象方法)
   */
  abstract getPlatformName(): string;

  /**
   * 检查平台支持 (抽象方法)
   */
  abstract isSupported(): boolean;

  /**
   * 平台特定初始化 (抽象方法)
   */
  protected abstract platformSpecificInitialize(): Promise<void>;

  /**
   * 平台特定菜单创建 (抽象方法)
   */
  protected abstract platformSpecificCreateMenu(items: MenuItemConfig[]): Promise<void>;

  /**
   * 平台特定销毁逻辑 (抽象方法)
   */
  protected abstract platformSpecificDestroy(): Promise<void>;

  /**
   * 初始化组件 (需要在子类中实现)
   */
  protected abstract initializeComponents(): Promise<void>;

  /**
   * 刷新菜单
   * 根据当前状态和配置重新生成菜单
   */
  protected async refreshMenu(): Promise<void> {
    if (!this.menuBuilder || !this.config) {
      console.warn(`[${this.getPlatformName()}] Menu builder or config not initialized`);
      return;
    }

    try {
      const state = this.currentState || await this.getCurrentPlayerState();

      console.log(`[${this.getPlatformName()}] 刷新菜单，使用状态:`, {
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

  /**
   * 设置状态监听器
   */
  protected setupStateListeners(): void {
    if (!this.stateManager) {
      console.warn(`[${this.getPlatformName()}] State manager not initialized`);
      return;
    }

    // 监听播放器状态变化
    this.stateManager.onStateChange((state: PlayerState) => {
      this.updatePlayerState(state);
    });
  }

  /**
   * 移除状态监听器
   */
  protected removeStateListeners(): void {
 
    console.log(`[${this.getPlatformName()}] Removing state listeners`);
  }

  /**
   * 获取当前播放器状态
   */
  protected async getCurrentPlayerState(): Promise<PlayerState> {
    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }
    
    return await this.stateManager.getCurrentState();
  }

  /**
   * 检查播放器状态是否发生变化
   */
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

  /**
   * 检查是否已初始化
   */
  protected checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`${this.getPlatformName()} controller not initialized`);
    }
  }
}