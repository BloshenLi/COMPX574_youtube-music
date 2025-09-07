/**
 * Quick Controls 插件类型定义
 * 定义跨平台快速控制功能的通用类型接口
 */

export interface QuickControlsConfig {
  enabled: boolean;                    
  showPlaybackControls: boolean;       
  showLikeButton: boolean;            
  showRepeatControl: boolean;
  showShuffleControl: boolean;         // 显示随机播放控制
}

export interface PlayerState {
  isPlaying: boolean;                 
  isPaused: boolean;                  
  repeatMode: RepeatMode;            
  canLike: boolean;                   
  hasCurrentSong: boolean;            
  isLiked: boolean;                   // 当前歌曲是否被喜欢
  isShuffled: boolean;                // 是否开启随机播放
}

export enum RepeatMode {
  OFF = 'off',                        
  ONE = 'one',                       
  ALL = 'all'                         
}

export interface MenuItemConfig {
  id: string;                         
  label: string;                      
  action: () => void;                 
  enabled?: boolean;                  
  checked?: boolean;                  
  separator?: boolean;
  submenu?: MenuItemConfig[];         // 支持子菜单
}


export interface PlatformOptions {
  macOS?: {
    showInDock: boolean;             
  };
  windows?: {
    showInTray: boolean;              
    enableJumpList: boolean;          
  };
  linux?: {
    showInTray: boolean;              
    desktopEnvironment?: string;      
  };
}

export enum QuickControlsError {
  PLATFORM_NOT_SUPPORTED = 'platform_not_supported',
  PLAYER_NOT_READY = 'player_not_ready',
  STATE_SYNC_FAILED = 'state_sync_failed',
  MENU_CREATE_FAILED = 'menu_create_failed'
}


export interface QuickControlsErrorInfo {
  type: QuickControlsError;
  message: string;
  context?: any;                      
}


export interface IPlatformController {

  initialize(window: any, config: QuickControlsConfig): Promise<void>;
  
  createMenu(items: MenuItemConfig[]): Promise<void>;

  updatePlayerState(state: PlayerState): Promise<void>;
  
  destroy(): Promise<void>;
  
  getPlatformName(): string;
  
  isSupported(): boolean;
}


export interface IStateManager {

  getCurrentState(): Promise<PlayerState>;
  
  onStateChange(callback: (state: PlayerState) => void): void;
  

  removeStateListener(callback: (state: PlayerState) => void): void;
  

  refreshState(): Promise<void>;
}


export interface IMenuBuilder {

  buildPlaybackControls(state: PlayerState): Promise<MenuItemConfig[]>;
  
  buildAdvancedControls(state: PlayerState): Promise<MenuItemConfig[]>;
  
  buildFullMenu(state: PlayerState, config: QuickControlsConfig): Promise<MenuItemConfig[]>;
}