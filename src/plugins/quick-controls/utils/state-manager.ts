// Player state manager for tracking YouTube Music player state
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import {
  registerCallback,
  SongInfoEvent,
  type SongInfoCallback,
} from '@/providers/song-info';

import type { IStateManager, PlayerState } from '../types';
import { RepeatMode } from '../types';

export class StateManager implements IStateManager {
  private stateCallbacks: Set<(state: PlayerState) => void> = new Set();
  private currentState: PlayerState | null = null;
  private songInfoCallback: SongInfoCallback | null = null;
  private window: BrowserWindow;
  private repeatUpdateDebounceTimer: NodeJS.Timeout | null = null;
  private shuffleUpdateDebounceTimer: NodeJS.Timeout | null = null;
  private menuRefreshCallback: (() => void) | null = null;

  constructor(window: BrowserWindow) {
    this.window = window;

    this.setupSongInfoListener();
    this.setupRepeatListeners();
    this.setupShuffleListeners();
    this.setupLanguageListener();

    setTimeout(() => {
      this.window.webContents.send('ytmd:get-like-status', 'startup');
    }, 3000);
  }

  async getCurrentState(): Promise<PlayerState> {
    try {
      const defaultState: PlayerState = {
        isPlaying: false,
        isPaused: true,
        repeatMode: RepeatMode.OFF,
        canLike: false,
        hasCurrentSong: false,
        isLiked: false,
        isShuffled: false,
      };

      if (this.currentState) {
        return { ...this.currentState };
      }

      return defaultState;
    } catch (error) {
      return {
        isPlaying: false,
        isPaused: true,
        repeatMode: RepeatMode.OFF,
        canLike: false,
        hasCurrentSong: false,
        isLiked: false,
        isShuffled: false,
      };
    }
  }

  onStateChange(callback: (state: PlayerState) => void): void {
    this.stateCallbacks.add(callback);
  }

  removeStateListener(callback: (state: PlayerState) => void): void {
    this.stateCallbacks.delete(callback);
  }

  async refreshState(): Promise<void> {
    try {
      const newState = await this.getCurrentState();
      this.currentState = newState;
      this.notifyStateChange(newState);
    } catch (error) {}
  }

  private setupSongInfoListener(): void {
    this.songInfoCallback = (songInfo, event) => {
      try {
        if (
          event === SongInfoEvent.PlayOrPaused ||
          event === SongInfoEvent.VideoSrcChanged
        ) {
          let isLiked = this.currentState?.isLiked || false;

          if (event === SongInfoEvent.VideoSrcChanged) {
            isLiked = false;
          }

          const newState: PlayerState = {
            isPlaying: !songInfo.isPaused,
            isPaused: !!songInfo.isPaused,
            repeatMode: this.currentState?.repeatMode || RepeatMode.OFF,
            canLike: !!songInfo.title,
            hasCurrentSong: !!songInfo.title,
            isLiked: isLiked,
            isShuffled: this.currentState?.isShuffled || false,
          };

          if (event === SongInfoEvent.VideoSrcChanged && songInfo.videoId) {
            this.requestLikeStatus(songInfo.videoId);
          }

          this.updateState(newState);
        }
      } catch (error) {}
    };

    registerCallback(this.songInfoCallback);
  }

  private updateState(newState: PlayerState): void {
    if (this.hasStateChanged(newState)) {
      this.currentState = { ...newState };
      this.notifyStateChange(newState);
    }
  }

  private notifyStateChange(state: PlayerState): void {
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (error) {}
    }
  }

  private hasStateChanged(newState: PlayerState): boolean {
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

  private requestLikeStatus(videoId: string): void {
    try {
      this.window.webContents.send('ytmd:get-like-status', videoId);
    } catch (error) {
      console.error('[StateManager] Failed to request like status:', error);
    }
  }

  private setupRepeatListeners(): void {
    ipcMain.on('ytmd:repeat-changed', (_, repeatMode: string) => {
      if (this.currentState) {
        let mode: RepeatMode = RepeatMode.OFF;
        switch (repeatMode) {
          case 'NONE':
            mode = RepeatMode.OFF;
            break;
          case 'ONE':
            mode = RepeatMode.ONE;
            break;
          case 'ALL':
            mode = RepeatMode.ALL;
            break;
          default:
            mode = RepeatMode.OFF;
            break;
        }

        if (this.repeatUpdateDebounceTimer) {
          clearTimeout(this.repeatUpdateDebounceTimer);
        }

        this.repeatUpdateDebounceTimer = setTimeout(() => {
          if (this.currentState && this.currentState.repeatMode !== mode) {
            const newState: PlayerState = {
              ...this.currentState,
              repeatMode: mode,
            };
            this.updateState(newState);
          }
          this.repeatUpdateDebounceTimer = null;
        }, 500);
      }
    });

    ipcMain.on(
      'ytmd:like-status-changed',
      (_, { isLiked }: { videoId: string; isLiked: boolean }) => {
        if (this.currentState) {
          if (this.currentState.isLiked !== isLiked) {
            const newState: PlayerState = {
              ...this.currentState,
              isLiked: isLiked,
            };
            this.updateState(newState);
          }
        }
      },
    );

    this.window.webContents.send('ytmd:setup-repeat-changed-listener');
    this.window.webContents.send('ytmd:setup-like-status-listener');
  }

  private setupShuffleListeners(): void {
    ipcMain.on('ytmd:shuffle-changed', (_, isShuffled: boolean) => {
      if (this.shuffleUpdateDebounceTimer) {
        clearTimeout(this.shuffleUpdateDebounceTimer);
      }

      this.shuffleUpdateDebounceTimer = setTimeout(() => {
        if (this.currentState) {
          if (this.currentState.isShuffled !== isShuffled) {
            const newState: PlayerState = {
              ...this.currentState,
              isShuffled: isShuffled,
            };
            this.updateState(newState);
          }
        }
        this.shuffleUpdateDebounceTimer = null;
      }, 500);
    });

    this.window.webContents.send('ytmd:setup-shuffle-changed-listener');
  }

  private setupLanguageListener(): void {
    ipcMain.on('ytmd:refresh-tray-menu', () => {
      console.log('[StateManager] Received tray menu refresh request');
      if (this.menuRefreshCallback) {
        this.menuRefreshCallback();
      }
    });
  }

  setMenuRefreshCallback(callback: () => void): void {
    this.menuRefreshCallback = callback;
  }

  destroy(): void {
    this.stateCallbacks.clear();

    if (this.repeatUpdateDebounceTimer) {
      clearTimeout(this.repeatUpdateDebounceTimer);
      this.repeatUpdateDebounceTimer = null;
    }
    if (this.shuffleUpdateDebounceTimer) {
      clearTimeout(this.shuffleUpdateDebounceTimer);
      this.shuffleUpdateDebounceTimer = null;
    }

    ipcMain.removeAllListeners('ytmd:repeat-changed');
    ipcMain.removeAllListeners('ytmd:shuffle-changed');
    ipcMain.removeAllListeners('ytmd:like-status-changed');
    ipcMain.removeAllListeners('ytmd:refresh-tray-menu');

    this.currentState = null;
    this.songInfoCallback = null;
  }
}
