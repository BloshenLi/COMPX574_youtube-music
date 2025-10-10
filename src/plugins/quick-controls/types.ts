// Quick Controls plugin types
export interface QuickControlsConfig {
  enabled: boolean;
  showPlaybackControls: boolean;
  showLikeButton: boolean;
  showRepeatControl: boolean;
  showShuffleControl: boolean;
}

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  repeatMode: RepeatMode;
  canLike: boolean;
  hasCurrentSong: boolean;
  isLiked: boolean;
  isShuffled: boolean;
}

export enum RepeatMode {
  OFF = 'off',
  ONE = 'one',
  ALL = 'all',
}

export interface MenuItemConfig {
  id: string;
  label: string;
  action: () => void;
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  submenu?: MenuItemConfig[];
}

export interface IPlatformController {
  initialize(
    window: Electron.BrowserWindow,
    config: QuickControlsConfig,
  ): Promise<void>;
  createMenu(items: MenuItemConfig[]): Promise<void>;
  updatePlayerState(state: PlayerState): Promise<void>;
  destroy(): Promise<void>;
  getPlatformName(): string;
  isSupported(): boolean;
}

export interface IStateManager {
  getCurrentState(): PlayerState;
  onStateChange(callback: (state: PlayerState) => void): void;
  removeStateListener(callback: (state: PlayerState) => void): void;
  refreshState(): Promise<void>;
}

export interface IMenuBuilder {
  buildPlaybackControls(state: PlayerState): MenuItemConfig[];
  buildAdvancedControls(state: PlayerState): MenuItemConfig[];
  buildFullMenu(
    state: PlayerState,
    config: QuickControlsConfig,
  ): MenuItemConfig[];
}
