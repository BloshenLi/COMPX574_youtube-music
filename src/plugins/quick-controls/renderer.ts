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
    const checkAndSendLikeStatus = (videoId?: string, retryCount: number = 0) => {
      // 首先找到所有 ytmusic-like-button-renderer 中的按钮
      const likeButtonRenderer = document.querySelector('ytmusic-like-button-renderer');

      if (!likeButtonRenderer) {
        console.warn('[Quick Controls] 未找到 ytmusic-like-button-renderer');
        return;
      }

      // 在 ytmusic-like-button-renderer 中查找 Like 按钮（排除 Dislike 按钮）
      const buttons = likeButtonRenderer.querySelectorAll('button[aria-pressed]');
      let likeButton: HTMLElement | null = null;

      for (const button of buttons) {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const title = button.getAttribute('title') || '';

        // 确保这是 Like 按钮而不是 Dislike 按钮
        if ((ariaLabel.toLowerCase().includes('like') && !ariaLabel.toLowerCase().includes('dislike')) ||
            (title.toLowerCase().includes('like') && !title.toLowerCase().includes('dislike')) ||
            ariaLabel.includes('喜欢') || title.includes('喜欢')) {
          likeButton = button as HTMLElement;
          break;
        }
      }

      // 如果还是没找到，尝试更广泛的搜索
      if (!likeButton) {
        const possibleSelectors = [
          'button[aria-label="Like"]',
          'button[aria-label="喜欢"]',
          'button[title="Like"]',
          'button[title="喜欢"]',
          'button[aria-label*="Like"]:not([aria-label*="Dislike"])',
          '#like-button button'
        ];

        for (const selector of possibleSelectors) {
          likeButton = document.querySelector(selector) as HTMLElement;
          if (likeButton) {
            break;
          }
        }
      }

      if (likeButton) {
        // 多种状态检测方式
        const ariaPressed = likeButton.getAttribute('aria-pressed');
        const ariaLabel = likeButton.getAttribute('aria-label') || '';
        const title = likeButton.getAttribute('title') || '';

        // 检查是否有激活状态的类名
        const hasActiveClass = likeButton.classList.contains('style-primary-text') ||
                              likeButton.classList.contains('active') ||
                              likeButton.classList.contains('liked');

        // 检查图标或文本内容
        const buttonText = likeButton.textContent || '';

        // 综合判断喜欢状态
        let isLiked = false;

        console.log(`[Quick Controls] Button state detection: ariaPressed=${ariaPressed}, ariaLabel="${ariaLabel}", title="${title}", hasActiveClass=${hasActiveClass}`);

        if (ariaPressed === 'true') {
          isLiked = true;
          console.log('[Quick Controls] Detected liked state from aria-pressed=true');
        } else if (ariaPressed === 'false') {
          isLiked = false;
          console.log('[Quick Controls] Detected not liked state from aria-pressed=false');
        } else if (hasActiveClass) {
          isLiked = true;
          console.log('[Quick Controls] Detected liked state from active CSS class');
        } else if (ariaLabel.toLowerCase().includes('unlike') || ariaLabel.includes('取消喜欢')) {
          isLiked = true;
          console.log('[Quick Controls] Detected liked state from "unlike" in aria-label');
        } else if (title.toLowerCase().includes('unlike') || title.includes('取消喜欢')) {
          isLiked = true;
          console.log('[Quick Controls] Detected liked state from "unlike" in title');
        } else if (buttonText.toLowerCase().includes('unlike') || buttonText.includes('取消喜欢')) {
          isLiked = true;
          console.log('[Quick Controls] Detected liked state from "unlike" in button text');
        } else {
          console.log('[Quick Controls] No liked state indicators found, defaulting to not liked');
        }

        // 如果检测到的状态可能不正确且还有重试次数，进行重试
        if (retryCount < 3 && ariaPressed === 'false' && retryCount > 0) {
          setTimeout(() => {
            checkAndSendLikeStatus(videoId, retryCount + 1);
          }, 500 * (retryCount + 1));
          return;
        }

        console.log(`[Quick Controls] Sending like status: videoId=${videoId || 'current'}, isLiked=${isLiked}`);
        ctx.ipc.send('ytmd:like-status-changed', {
          videoId: videoId || 'current',
          isLiked: isLiked
        });
      } else {
        console.warn('[Quick Controls] 未找到喜欢按钮');

        // 调试：列出 ytmusic-like-button-renderer 中的所有按钮
      }
    };

    // 监听后端请求获取喜欢状态
    ctx.ipc.on('ytmd:get-like-status', (videoId: string) => {
      console.log(`[Quick Controls] Received get-like-status request for videoId: ${videoId}`);
      checkAndSendLikeStatus(videoId);

      // 当收到新歌曲的like状态请求时，重新设置按钮监听器
      if (videoId && videoId !== 'startup') {
        console.log('[Quick Controls] Song changed, re-setting up like button listener');
        setTimeout(setupLikeButtonListener, 1000); // 延迟1秒确保DOM更新
      }
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

    // 监听语言更改事件，刷新托盘菜单
    ctx.ipc.on('ytmd:language-changed', (language: string) => {
      console.log(`[Quick Controls] Language changed to: ${language}`);
      // 通知后端刷新托盘菜单
      ctx.ipc.send('ytmd:refresh-tray-menu');
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
      // 首先查找播放器区域
      const playerBar = document.querySelector('ytmusic-player-bar');
      let shuffleButton: HTMLElement | null = null;

      if (playerBar) {
        // 在播放器区域查找shuffle按钮，优先查找有aria-pressed属性的
        const possibleSelectors = [
          'button[aria-label*="Shuffle" i][aria-pressed]',
          'button[aria-label*="随机"][aria-pressed]',
          // 如果没有aria-pressed，也尝试查找
          'button[aria-label*="Shuffle" i]',
          'button[aria-label*="随机"]',
          'button[title*="Shuffle" i]',
          'button[title*="随机"]',
        ];

        for (const selector of possibleSelectors) {
          const candidate = playerBar.querySelector(selector) as HTMLElement;
          if (candidate) {
            // 优先选择有aria-pressed属性的按钮
            if (candidate.hasAttribute('aria-pressed') || !shuffleButton) {
              shuffleButton = candidate;
              if (candidate.hasAttribute('aria-pressed')) {
                break; // 找到有aria-pressed的，立即使用
              }
            }
          }
        }
      }

      // 备用：全页面搜索
      if (!shuffleButton) {
        const fallbackSelectors = [
          'button[aria-label*="Shuffle" i]',
          'button[aria-label*="随机"]',
          'button[title*="Shuffle" i]',
          'button[title*="随机"]',
          '.shuffle-button'
        ];

        for (const selector of fallbackSelectors) {
          shuffleButton = document.querySelector(selector) as HTMLElement;
          if (shuffleButton) {
            break;
          }
        }
      }

      if (shuffleButton) {
        const ariaPressed = shuffleButton.getAttribute('aria-pressed');
        const ariaLabel = shuffleButton.getAttribute('aria-label') || '';

        // 多重状态检测
        let isShuffled = false;

        // 1. 优先使用 aria-pressed 属性
        if (ariaPressed === 'true') {
          isShuffled = true;
        } else if (ariaPressed === 'false') {
          isShuffled = false;
        } else {
          // 2. 检查CSS类名
          const hasActiveClass = shuffleButton.classList.contains('style-primary-text') ||
                                shuffleButton.classList.contains('active') ||
                                shuffleButton.classList.contains('shuffled') ||
                                shuffleButton.classList.contains('enabled');

          if (hasActiveClass) {
            isShuffled = true;
          } else {
            // 3. 检查文本内容是否包含"off"
            if (ariaLabel.toLowerCase().includes('shuffle off') || ariaLabel.includes('关闭随机')) {
              isShuffled = false;
            } else if (ariaLabel.toLowerCase().includes('shuffle on') || ariaLabel.includes('打开随机')) {
              isShuffled = true;
            } else {
              // 4. 最后使用颜色检测作为备用方案
              const buttonStyle = window.getComputedStyle(shuffleButton);
              if (buttonStyle.color) {
                const colorMatch = buttonStyle.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (colorMatch) {
                  const [, r, g, b] = colorMatch.map(Number);
                  const brightness = (r + g + b) / 3;
                  isShuffled = brightness > 180; // 亮色表示激活
                }
              }
            }
          }
        }


        ctx.ipc.send('ytmd:shuffle-changed', isShuffled);
      } else {
        console.warn('[Quick Controls] 未找到随机播放按钮');

      }
    };

    // 页面加载后检测状态
    setTimeout(checkRepeatState, 3000);
    setTimeout(checkShuffleState, 3000);
    setTimeout(checkAndSendLikeStatus, 3000); // 初始检测喜欢状态

    // 用于存储当前的监听器，方便清理
    let currentLikeButtonObserver: MutationObserver | null = null;
    let currentRendererObserver: MutationObserver | null = null;

    // 设置喜欢按钮的监听器
    const setupLikeButtonListener = () => {
      // 清理之前的监听器
      if (currentLikeButtonObserver) {
        currentLikeButtonObserver.disconnect();
        currentLikeButtonObserver = null;
      }
      if (currentRendererObserver) {
        currentRendererObserver.disconnect();
        currentRendererObserver = null;
      }

      console.log('[Quick Controls] Setting up like button listener...');
      // 使用与checkAndSendLikeStatus完全相同的逻辑
      const likeButtonRenderer = document.querySelector('ytmusic-like-button-renderer');

      if (!likeButtonRenderer) {
        setTimeout(setupLikeButtonListener, 1000);
        return;
      }

      // 使用相同的按钮查找逻辑
      const buttons = likeButtonRenderer.querySelectorAll('button[aria-pressed]');
      let likeButton: HTMLElement | null = null;

      for (const button of buttons) {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const title = button.getAttribute('title') || '';

        // 确保这是 Like 按钮而不是 Dislike 按钮
        if ((ariaLabel.toLowerCase().includes('like') && !ariaLabel.toLowerCase().includes('dislike')) ||
            (title.toLowerCase().includes('like') && !title.toLowerCase().includes('dislike')) ||
            ariaLabel.includes('喜欢') || title.includes('喜欢')) {
          likeButton = button as HTMLElement;
          break;
        }
      }

      // 如果还是没找到，尝试更广泛的搜索（与checkAndSendLikeStatus保持一致）
      if (!likeButton) {
        const possibleSelectors = [
          'button[aria-label="Like"]',
          'button[aria-label="喜欢"]',
          'button[title="Like"]',
          'button[title="喜欢"]',
          'button[aria-label*="Like"]:not([aria-label*="Dislike"])',
          '#like-button button'
        ];

        for (const selector of possibleSelectors) {
          likeButton = document.querySelector(selector) as HTMLElement;
          if (likeButton) {
            break;
          }
        }
      }

      if (likeButton) {
        // 使用 MutationObserver 监听按钮属性变化
        currentLikeButtonObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'aria-pressed' ||
                 mutation.attributeName === 'aria-label' ||
                 mutation.attributeName === 'class')) {
              // 状态发生变化，检测新状态并发送
              setTimeout(() => {
                checkAndSendLikeStatus();
              }, 200);
            }
          });
        });

        currentLikeButtonObserver.observe(likeButton, {
          attributes: true,
          attributeFilter: ['aria-pressed', 'aria-label', 'class']
        });

        // 同时监听点击事件作为备用
        likeButton.addEventListener('click', () => {
          console.log('[Quick Controls] Like button clicked, will update menu text');
          // 增加延迟，等待YouTube Music更新DOM
          setTimeout(() => {
            console.log('[Quick Controls] Checking like status after click...');
            checkAndSendLikeStatus(undefined, 1); // 从重试1开始，因为这是点击后的检测
          }, 800); // 从300ms增加到800ms
        });

        // 监听整个 ytmusic-like-button-renderer 的变化，防止按钮被重新渲染
        if (likeButtonRenderer) {
          currentRendererObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                console.log('[Quick Controls] Like button renderer changed, re-setting up listener');
                setTimeout(setupLikeButtonListener, 500);
              }
            });
          });

          currentRendererObserver.observe(likeButtonRenderer, {
            childList: true,
            subtree: true
          });
        }

        console.log('[Quick Controls] Like button listener setup completed');
      } else {
        // 如果按钮还没加载，稍后再试
        setTimeout(setupLikeButtonListener, 1000);
      }
    };

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

    // 改进的定期检测 shuffle 状态变化
    let lastKnownShuffleState: boolean | null = null;
    const checkShuffleStateChange = () => {
      // 使用相同的逻辑查找shuffle按钮
      const playerBar = document.querySelector('ytmusic-player-bar');
      let shuffleButton: HTMLElement | null = null;

      if (playerBar) {
        const possibleSelectors = [
          'button[aria-label*="Shuffle" i][aria-pressed]',
          'button[aria-label*="随机"][aria-pressed]',
          'button[aria-label*="Shuffle" i]',
          'button[aria-label*="随机"]'
        ];

        for (const selector of possibleSelectors) {
          shuffleButton = playerBar.querySelector(selector) as HTMLElement;
          if (shuffleButton) {
            break;
          }
        }
      }

      if (shuffleButton) {
        const ariaPressed = shuffleButton.getAttribute('aria-pressed');
        let currentState = false;

        // 使用改进的状态检测逻辑
        if (ariaPressed === 'true') {
          currentState = true;
        } else if (ariaPressed === 'false') {
          currentState = false;
        } else {
          // 备用检测方法
          const hasActiveClass = shuffleButton.classList.contains('style-primary-text') ||
                                shuffleButton.classList.contains('active');
          if (hasActiveClass) {
            currentState = true;
          } else {
            // 最后使用颜色检测
            const buttonStyle = window.getComputedStyle(shuffleButton);
            if (buttonStyle.color) {
              const colorMatch = buttonStyle.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
              if (colorMatch) {
                const [, r, g, b] = colorMatch.map(Number);
                const brightness = (r + g + b) / 3;
                currentState = brightness > 180;
              }
            }
          }
        }

        // 只在状态真的改变时发送消息
        if (lastKnownShuffleState !== null && lastKnownShuffleState !== currentState) {
          ctx.ipc.send('ytmd:shuffle-changed', currentState);
        }
        lastKnownShuffleState = currentState;
      }
    };

    // 设置按钮监听器
    setTimeout(setupLikeButtonListener, 3000);
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