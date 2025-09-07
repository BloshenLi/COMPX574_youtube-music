/**
 * Quick Controls 前端脚本
 */

import { createRenderer } from '@/utils';
import type { RendererContext } from '@/types/contexts';
import type { QuickControlsConfig } from './types';

export const renderer = createRenderer<{
  ctx?: RendererContext<QuickControlsConfig>;
}, QuickControlsConfig>({
  
  async start(ctx: RendererContext<QuickControlsConfig>) {
    this.ctx = ctx;

    // 检测并发送喜欢状态的通用函数
    const checkAndSendLikeStatus = (videoId?: string) => {
      // 查找喜欢按钮
      const likeButton = document.querySelector('button[aria-label="Like"]') as HTMLElement;
      
      if (likeButton) {
        const ariaPressed = likeButton.getAttribute('aria-pressed');
        const isLiked = ariaPressed === 'true';
        
        ctx.ipc.send('ytmd:like-status-changed', {
          videoId: videoId || 'current',
          isLiked: isLiked
        });
      }
    };

    // 监听后端请求获取喜欢状态
    ctx.ipc.on('ytmd:get-like-status', (videoId: string) => {
      console.log(`[Quick Controls] 收到获取喜欢状态请求: ${videoId}`);
      checkAndSendLikeStatus(videoId);
    });

    // 监听后端请求刷新喜欢状态（在用户点击菜单按钮后）
    ctx.ipc.on('ytmd:refresh-like-status', () => {
      checkAndSendLikeStatus();
    });

    // 监听后端请求刷新循环状态（在用户点击菜单按钮后）
    ctx.ipc.on('ytmd:refresh-repeat-status', () => {
      setTimeout(checkRepeatState, 500); // 等待DOM更新后再检测
    });

    // 监听后端请求刷新随机播放状态
    ctx.ipc.on('ytmd:refresh-shuffle-status', () => {
      setTimeout(checkShuffleState, 500); // 等待DOM更新后再检测
    });

    // 检测循环播放状态
    const checkRepeatState = () => {
      const repeatButton = document.querySelector('button[aria-label*="Repeat"]') as HTMLElement;
      if (repeatButton) {
        const ariaLabel = repeatButton.getAttribute('aria-label') || '';
        
        let mode = 'NONE';
        
        // 检测循环播放模式
        if (ariaLabel.toLowerCase().includes('repeat one') || ariaLabel.includes('单曲循环')) {
          mode = 'ONE';
        } else if (ariaLabel.toLowerCase().includes('repeat all') || ariaLabel.includes('列表循环')) {
          mode = 'ALL';
        }
        
        ctx.ipc.send('ytmd:repeat-changed', mode);
      }
    };

    // 检测随机播放状态
    const checkShuffleState = () => {
      // 尝试多种可能的选择器
      const possibleSelectors = [
        'button[aria-label*="Shuffle"]',
        'button[aria-label*="随机"]',
        'button[title*="Shuffle"]',
        'button[title*="随机"]',
        '.shuffle-button',
        'ytmusic-player-bar button[aria-label*="Shuffle"]'
      ];
      
      let shuffleButton: HTMLElement | null = null;
      
      for (const selector of possibleSelectors) {
        shuffleButton = document.querySelector(selector) as HTMLElement;
        if (shuffleButton) {
          break;
        }
      }
      
      if (shuffleButton) {
        // 检查按钮样式来判断状态
        const buttonStyle = window.getComputedStyle(shuffleButton);
        let isShuffled = false;
        
        // YouTube Music 通过颜色来表示按钮状态
        if (buttonStyle.color) {
          const colorMatch = buttonStyle.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (colorMatch) {
            const [, r, g, b] = colorMatch.map(Number);
            // 计算颜色亮度，亮度高表示激活状态
            const brightness = (r + g + b) / 3;
            isShuffled = brightness > 180; // 灰色(144)以上认为是激活
          }
        }
        
        ctx.ipc.send('ytmd:shuffle-changed', isShuffled);
      }
    };

    // 页面加载后检测状态
    setTimeout(checkRepeatState, 3000);
    setTimeout(checkShuffleState, 3000);

    // 监听主界面重复播放按钮的点击事件
    const setupRepeatButtonListener = () => {
      const repeatButton = document.querySelector('button[aria-label*="Repeat"]') as HTMLElement;
      if (repeatButton) {
        // 使用 MutationObserver 监听按钮属性变化
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'aria-label' || mutation.attributeName === 'aria-pressed')) {
              // 状态发生变化，检测新状态
              setTimeout(checkRepeatState, 100);
            }
          });
        });
        
        observer.observe(repeatButton, {
          attributes: true,
          attributeFilter: ['aria-label', 'aria-pressed']
        });
        
        // 同时监听点击事件作为备用
        repeatButton.addEventListener('click', () => {
          setTimeout(checkRepeatState, 500);
        });
      } else {
        // 如果按钮还没加载，稍后再试
        setTimeout(setupRepeatButtonListener, 1000);
      }
    };

    // 简单的定期检测 shuffle 状态变化
    let lastKnownShuffleState: boolean | null = null;
    const checkShuffleStateChange = () => {
      const shuffleButton = document.querySelector('button[aria-label*="Shuffle"]') as HTMLElement;
      if (shuffleButton) {
        const buttonStyle = window.getComputedStyle(shuffleButton);
        if (buttonStyle.color) {
          const colorMatch = buttonStyle.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (colorMatch) {
            const [, r, g, b] = colorMatch.map(Number);
            const brightness = (r + g + b) / 3;
            const currentState = brightness > 180;
            
            // 只在状态真的改变时发送消息
            if (lastKnownShuffleState !== null && lastKnownShuffleState !== currentState) {
              ctx.ipc.send('ytmd:shuffle-changed', currentState);
            }
            lastKnownShuffleState = currentState;
          }
        }
      }
    };

    // 设置按钮监听器
    setTimeout(setupRepeatButtonListener, 3000);
    
    // 启动 shuffle 状态检测，每 3 秒检查一次
    setTimeout(() => {
      checkShuffleStateChange(); // 初始检测
      setInterval(checkShuffleStateChange, 3000);
    }, 3000);

  },

  stop() {
  }
});