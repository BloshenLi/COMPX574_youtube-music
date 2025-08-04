/**
 * 播放器状态管理器
 * 负责获取和监听 YouTube Music 播放器状态变化
 */

import type { BrowserWindow } from 'electron';
import getSongControls from '@/providers/song-controls';
import registerCallback, { SongInfoEvent, type SongInfoCallback } from '@/providers/song-info';

import type { 
  IStateManager, 
  PlayerState, 
  RepeatMode 
} from '../types';

/**
 * 状态管理器实现类
 * 集成项目现有的 song-controls 和 song-info 系统
 */
export class StateManager implements IStateManager {
  private songControls: ReturnType<typeof getSongControls>;
  private stateCallbacks: Set<(state: PlayerState) => void> = new Set();
  private currentState: PlayerState | null = null;
  private songInfoCallback: SongInfoCallback | null = null;

  constructor(window: BrowserWindow) {
    this.songControls = getSongControls(window);
   
    this.setupSongInfoListener();
  }

  /**
   * 获取当前播放器状态
   * 异步获取最新的播放器状态信息
   */
  async getCurrentState(): Promise<PlayerState> {
    try {
      const defaultState: PlayerState = {
        isPlaying: false,
        isPaused: true,
        shuffleEnabled: false,
        repeatMode: 'off' as RepeatMode,
        canLike: false,
        hasCurrentSong: false
      };

      if (this.currentState) {
        return { ...this.currentState };
      }

      // TODO: 
      
      return defaultState;
      
    } catch (error) {
      
      return {
        isPlaying: false,
        isPaused: true,
        shuffleEnabled: false,
        repeatMode: 'off' as RepeatMode,
        canLike: false,
        hasCurrentSong: false
      };
    }
  }

  /**
   * 监听状态变化
   * 注册回调函数以接收播放器状态变化通知
   */
  onStateChange(callback: (state: PlayerState) => void): void {
    this.stateCallbacks.add(callback);
  }

  /**
   * 移除状态监听器
   */
  removeStateListener(callback: (state: PlayerState) => void): void {
    this.stateCallbacks.delete(callback);
  }

  /**
   * 刷新状态
   * 强制刷新当前播放器状态
   */
  async refreshState(): Promise<void> {
    try {
      this.songControls.requestShuffleInformation();
      
      const newState = await this.getCurrentState();
      
      this.currentState = newState;
      
      this.notifyStateChange(newState);
      
    } catch (error) {
    }
  }

  /**
   * 设置歌曲信息监听器
   * 利用现有的 song-info 系统监听播放状态变化
   */
  private setupSongInfoListener(): void {
    this.songInfoCallback = (songInfo, event) => {
      try {
        if (event === SongInfoEvent.PlayOrPaused) {
  
          const newState: PlayerState = {
            isPlaying: !songInfo.isPaused,
            isPaused: !!songInfo.isPaused,
            shuffleEnabled: false,  
            repeatMode: 'off' as RepeatMode,  
            canLike: !!songInfo.title,  
            hasCurrentSong: !!songInfo.title
          };
          
          this.updateState(newState);
        }
        
      } catch (error) {
      }
    };

    registerCallback(this.songInfoCallback);
  }

  /**
   * 更新状态并通知监听器
   */
  private updateState(newState: PlayerState): void {
    
    if (this.hasStateChanged(newState)) {
      this.currentState = { ...newState };
 
      this.notifyStateChange(newState);
    }
  }

  /**
   * 通知所有状态变化监听器
   */
  private notifyStateChange(state: PlayerState): void {
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (error) {
      }
    }
  }

  /**
   * 检查状态是否发生变化
   */
  private hasStateChanged(newState: PlayerState): boolean {
    if (!this.currentState) {
      return true; 
    }

    return (
      this.currentState.isPlaying !== newState.isPlaying ||
      this.currentState.isPaused !== newState.isPaused ||
      this.currentState.shuffleEnabled !== newState.shuffleEnabled ||
      this.currentState.repeatMode !== newState.repeatMode ||
      this.currentState.canLike !== newState.canLike ||
      this.currentState.hasCurrentSong !== newState.hasCurrentSong
    );
  }

  /**
   * 销毁状态管理器，清理资源
   */
  destroy(): void {
    this.stateCallbacks.clear();

    this.currentState = null;
    this.songInfoCallback = null;
  }
}