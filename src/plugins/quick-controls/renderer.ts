// Quick Controls renderer script
import { createRenderer } from '@/utils';
import type { RendererContext } from '@/types/contexts';
import type { QuickControlsConfig } from './types';

export const renderer = createRenderer<{
  ctx?: RendererContext<QuickControlsConfig>;
}, QuickControlsConfig>({

  async start(ctx: RendererContext<QuickControlsConfig>) {
    this.ctx = ctx;

    const checkAndSendLikeStatus = (videoId?: string, retryCount: number = 0) => {
      // likeStatus 
      const likeButtonRenderer = document.querySelector('#like-button-renderer') as any;

      if (!likeButtonRenderer) {
        console.warn('[Quick Controls] #like-button-renderer not found');
        return;
      }

      const likeStatus = likeButtonRenderer.likeStatus;
      const isLiked = likeStatus === 'LIKE';

      console.log(`[Quick Controls] Like status from renderer: likeStatus="${likeStatus}", isLiked=${isLiked}`);

      if (!likeStatus && retryCount < 3) {
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
    };

    ctx.ipc.on('ytmd:get-like-status', (videoId: string) => {
      console.log(`[Quick Controls] Received get-like-status request for videoId: ${videoId}`);
      checkAndSendLikeStatus(videoId);

      if (videoId && videoId !== 'startup') {
        console.log('[Quick Controls] Song changed, re-setting up like button listener');
        setTimeout(setupLikeButtonListener, 1000);
      }
    });

    ctx.ipc.on('ytmd:refresh-like-status', () => {
      checkAndSendLikeStatus();
    });

    ctx.ipc.on('ytmd:refresh-repeat-status', () => {
      setTimeout(checkRepeatState, 500);
    });

    ctx.ipc.on('ytmd:refresh-shuffle-status', () => {
      setTimeout(checkShuffleState, 500);
    });

    ctx.ipc.on('ytmd:language-changed', (language: string) => {
      console.log(`[Quick Controls] Language changed to: ${language}`);
      ctx.ipc.send('ytmd:refresh-tray-menu');
    });

    const checkRepeatState = () => {
      // Use title attribute which contains numeric mode info
      const repeatButton = document.querySelector('.repeat') as HTMLElement;
      if (repeatButton) {
        const title = repeatButton.getAttribute('title') || '';
        const ariaLabel = repeatButton.getAttribute('aria-label') || '';

        let mode = 'NONE';

        // Check for repeat mode using title or other attributes
        if (title.includes('1') || ariaLabel.toLowerCase().includes('one')) {
          mode = 'ONE';
        } else if (title.toLowerCase().includes('all') || ariaLabel.toLowerCase().includes('all')) {
          mode = 'ALL';
        }

        ctx.ipc.send('ytmd:repeat-changed', mode);
      }
    };

    const checkShuffleState = () => {
      const playerBar = document.querySelector('ytmusic-player-bar');
      let shuffleButton: HTMLElement | null = null;

      if (playerBar) {
        const possibleSelectors = [
          'button[aria-pressed].shuffle',
          '.shuffle-button[aria-pressed]',
          'button[aria-pressed]',
        ];

        for (const selector of possibleSelectors) {
          const candidate = playerBar.querySelector(selector) as HTMLElement;
          if (candidate) {
            if (candidate.hasAttribute('aria-pressed') || !shuffleButton) {
              shuffleButton = candidate;
              if (candidate.hasAttribute('aria-pressed')) {
                break;
              }
            }
          }
        }
      }

      if (!shuffleButton) {
        const fallbackSelectors = [
          '.shuffle',
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

        let isShuffled = false;

        if (ariaPressed === 'true') {
          isShuffled = true;
        } else if (ariaPressed === 'false') {
          isShuffled = false;
        } else {
          const hasActiveClass = shuffleButton.classList.contains('style-primary-text') ||
                                shuffleButton.classList.contains('active') ||
                                shuffleButton.classList.contains('shuffled') ||
                                shuffleButton.classList.contains('enabled');

          if (hasActiveClass) {
            isShuffled = true;
          } else {
            const buttonStyle = window.getComputedStyle(shuffleButton);
            if (buttonStyle.color) {
              const colorMatch = buttonStyle.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
              if (colorMatch) {
                const [, r, g, b] = colorMatch.map(Number);
                const brightness = (r + g + b) / 3;
                isShuffled = brightness > 180;
              }
            }
          }
        }

        ctx.ipc.send('ytmd:shuffle-changed', isShuffled);
      } else {
        console.warn('[Quick Controls] Shuffle button not found');
      }
    };

    setTimeout(checkRepeatState, 3000);
    setTimeout(checkShuffleState, 3000);
    setTimeout(checkAndSendLikeStatus, 3000);

    let currentLikeButtonObserver: MutationObserver | null = null;
    let currentRendererObserver: MutationObserver | null = null;

    const setupLikeButtonListener = () => {
      if (currentLikeButtonObserver) {
        currentLikeButtonObserver.disconnect();
        currentLikeButtonObserver = null;
      }
      if (currentRendererObserver) {
        currentRendererObserver.disconnect();
        currentRendererObserver = null;
      }

      console.log('[Quick Controls] Setting up like button listener...');
      const likeButtonRenderer = document.querySelector('ytmusic-like-button-renderer');

      if (!likeButtonRenderer) {
        setTimeout(setupLikeButtonListener, 1000);
        return;
      }

      // First button with aria-pressed is Like, second is Dislike
      const buttons = likeButtonRenderer.querySelectorAll('button[aria-pressed]');
      const likeButton = buttons[0] as HTMLElement;

      if (likeButton) {
        currentLikeButtonObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'aria-pressed' ||
                 mutation.attributeName === 'aria-label' ||
                 mutation.attributeName === 'class')) {
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

        likeButton.addEventListener('click', () => {
          console.log('[Quick Controls] Like button clicked, will update menu text');
          setTimeout(() => {
            console.log('[Quick Controls] Checking like status after click...');
            checkAndSendLikeStatus(undefined, 1);
          }, 800);
        });

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
        setTimeout(setupLikeButtonListener, 1000);
      }
    };

    const setupRepeatButtonListener = () => {
      const repeatButton = document.querySelector('.repeat') as HTMLElement;
      if (repeatButton) {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'aria-label' || mutation.attributeName === 'aria-pressed')) {
              setTimeout(checkRepeatState, 100);
            }
          });
        });

        observer.observe(repeatButton, {
          attributes: true,
          attributeFilter: ['aria-label', 'aria-pressed']
        });

        repeatButton.addEventListener('click', () => {
          setTimeout(checkRepeatState, 500);
        });
      } else {
        setTimeout(setupRepeatButtonListener, 1000);
      }
    };

    let lastKnownShuffleState: boolean | null = null;
    const checkShuffleStateChange = () => {
      const playerBar = document.querySelector('ytmusic-player-bar');
      let shuffleButton: HTMLElement | null = null;

      if (playerBar) {
        const possibleSelectors = [
          'button[aria-pressed].shuffle',
          '.shuffle-button[aria-pressed]',
          'button[aria-pressed]'
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

        if (ariaPressed === 'true') {
          currentState = true;
        } else if (ariaPressed === 'false') {
          currentState = false;
        } else {
          const hasActiveClass = shuffleButton.classList.contains('style-primary-text') ||
                                shuffleButton.classList.contains('active');
          if (hasActiveClass) {
            currentState = true;
          } else {
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

        if (lastKnownShuffleState !== null && lastKnownShuffleState !== currentState) {
          ctx.ipc.send('ytmd:shuffle-changed', currentState);
        }
        lastKnownShuffleState = currentState;
      }
    };

    setTimeout(setupLikeButtonListener, 3000);
    setTimeout(setupRepeatButtonListener, 3000);

    setTimeout(() => {
      checkShuffleStateChange();
      setInterval(checkShuffleStateChange, 3000);
    }, 3000);

  },

  stop() {
  }
});
