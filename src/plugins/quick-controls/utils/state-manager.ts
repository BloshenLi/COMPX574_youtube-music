/**
 * 播放器状态管理器
 * 负责获取和监听 YouTube Music 播放器状态变化
 */

import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import registerCallback, { SongInfoEvent, type SongInfoCallback } from '@/providers/song-info';

import type { 
  IStateManager, 
  PlayerState
} from '../types';
import { RepeatMode } from '../types';

/**
 * 状态管理器实现类
 * 集成项目现有的 song-controls 和 song-info 系统
 */
export class StateManager implements IStateManager {
  private stateCallbacks: Set<(state: PlayerState) => void> = new Set();
  private currentState: PlayerState | null = null;
  private songInfoCallback: SongInfoCallback | null = null;
  private window: BrowserWindow;
  private repeatUpdateDebounceTimer: NodeJS.Timeout | null = null;
  private shuffleUpdateDebounceTimer: NodeJS.Timeout | null = null;

  constructor(window: BrowserWindow) {
    this.window = window;
   
    this.setupSongInfoListener();
    this.setupRepeatListeners();
    this.setupShuffleListeners();
    
    // 启动后主动检测第一首歌的喜欢状态
    setTimeout(() => {
      this.window.webContents.send('ytmd:get-like-status', 'startup');
    }, 3000); // 等待页面加载完成
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
        repeatMode: RepeatMode.OFF,
        canLike: false,
        hasCurrentSong: false,
        isLiked: false,
        isShuffled: false
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
        isShuffled: false
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
        if (event === SongInfoEvent.PlayOrPaused || event === SongInfoEvent.VideoSrcChanged) {
          let isLiked = this.currentState?.isLiked || false;
          
          // 当歌曲切换时，重置like状态，等待前端检测
          if (event === SongInfoEvent.VideoSrcChanged) {
            isLiked = false; 
            console.log(`[StateManager] Song changed to videoId: ${songInfo.videoId}, resetting like state`);
          }
          
          const newState: PlayerState = {
            isPlaying: !songInfo.isPaused,
            isPaused: !!songInfo.isPaused,
            repeatMode: this.currentState?.repeatMode || RepeatMode.OFF,  
            canLike: !!songInfo.title,  
            hasCurrentSong: !!songInfo.title,
            isLiked: isLiked,
            isShuffled: this.currentState?.isShuffled || false
          };
          
          // 当歌曲切换时，获取新歌曲的like状态
          if (event === SongInfoEvent.VideoSrcChanged && songInfo.videoId) {
            console.log(`[StateManager] 请求获取歌曲 ${songInfo.videoId} 的喜欢状态`);
            this.requestLikeStatus(songInfo.videoId);
          }
          
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
      this.currentState.repeatMode !== newState.repeatMode ||
      this.currentState.canLike !== newState.canLike ||
      this.currentState.hasCurrentSong !== newState.hasCurrentSong ||
      this.currentState.isLiked !== newState.isLiked ||
      this.currentState.isShuffled !== newState.isShuffled
    );
  }

  /**
   * 请求获取指定视频的like状态
   * 向前端请求当前歌曲的like状态信息
   */
  private requestLikeStatus(videoId: string): void {
    try {
      this.window.webContents.send('ytmd:get-like-status', videoId);
    } catch (error) {
      console.error('[StateManager] Failed to request like status:', error);
    }
  }

  /**
   * 设置 repeat 状态监听器
   * 监听来自前端的状态变化事件
   */
  private setupRepeatListeners(): void {

    // 监听循环播放模式变化，使用防抖处理频繁更新
    ipcMain.on('ytmd:repeat-changed', (_, repeatMode: string) => {
      if (this.currentState) {
        // 将前端的 repeat 模式转换为我们的 RepeatMode 枚举
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

        // 调试日志
        console.log(`[StateManager] Repeat mode change: ${this.currentState.repeatMode} -> ${mode} (raw: ${repeatMode})`);

        // 使用防抖处理，避免频繁的状态更新干扰菜单显示
        if (this.repeatUpdateDebounceTimer) {
          clearTimeout(this.repeatUpdateDebounceTimer);
        }

        this.repeatUpdateDebounceTimer = setTimeout(() => {
          if (this.currentState && this.currentState.repeatMode !== mode) {
            console.log(`[StateManager] Debounced update: repeat mode from ${this.currentState.repeatMode} to ${mode}`);
            const newState: PlayerState = {
              ...this.currentState,
              repeatMode: mode,
            };
            this.updateState(newState);
          } else {
            console.log(`[StateManager] Debounced ignore: duplicate repeat mode update: ${mode}`);
          }
          this.repeatUpdateDebounceTimer = null;
        }, 500); // 500ms 防抖延迟
      }
    });

    // 监听like状态变化
    ipcMain.on('ytmd:like-status-changed', (_, { videoId, isLiked }: { videoId: string; isLiked: boolean }) => {
      if (this.currentState) {
        console.log(`[StateManager] Like status change for ${videoId}: ${isLiked}`);
        
        const newState: PlayerState = {
          ...this.currentState,
          isLiked: isLiked,
        };
        this.updateState(newState);
      }
    });

    // 请求前端设置状态监听器
    this.window.webContents.send('ytmd:setup-repeat-changed-listener');
    this.window.webContents.send('ytmd:setup-like-status-listener');
  }

  /**
   * 设置 shuffle 状态监听器
   * 监听来自前端的随机播放状态变化事件
   */
  private setupShuffleListeners(): void {
    // 监听随机播放状态变化，使用防抖处理频繁更新
    ipcMain.on('ytmd:shuffle-changed', (_, isShuffled: boolean) => {
      // 使用防抖处理，避免频繁的状态更新干扰菜单显示
      if (this.shuffleUpdateDebounceTimer) {
        clearTimeout(this.shuffleUpdateDebounceTimer);
      }

      this.shuffleUpdateDebounceTimer = setTimeout(() => {
        if (this.currentState) {
          // 如果已有状态，正常更新
          if (this.currentState.isShuffled !== isShuffled) {
            const newState: PlayerState = {
              ...this.currentState,
              isShuffled: isShuffled
            };
            this.updateState(newState);
          }
        } else {
          // 如果没有初始状态，暂时跳过 shuffle 更新
          // 重启后 shuffle 默认是关闭的，等歌曲信息回调初始化状态后再处理
        }
        this.shuffleUpdateDebounceTimer = null;
      }, 500); // 500ms 防抖延迟
    });

    // 请求前端设置状态监听器
    this.window.webContents.send('ytmd:setup-shuffle-changed-listener');
  }

  /**
   * 销毁状态管理器，清理资源
   */
  destroy(): void {
    this.stateCallbacks.clear();

    // 清理防抖定时器
    if (this.repeatUpdateDebounceTimer) {
      clearTimeout(this.repeatUpdateDebounceTimer);
      this.repeatUpdateDebounceTimer = null;
    }
    if (this.shuffleUpdateDebounceTimer) {
      clearTimeout(this.shuffleUpdateDebounceTimer);
      this.shuffleUpdateDebounceTimer = null;
    }

    // 移除 IPC 监听器
    ipcMain.removeAllListeners('ytmd:repeat-changed');
    ipcMain.removeAllListeners('ytmd:shuffle-changed');
    ipcMain.removeAllListeners('ytmd:like-status-changed');

    this.currentState = null;
    this.songInfoCallback = null;
  }
}