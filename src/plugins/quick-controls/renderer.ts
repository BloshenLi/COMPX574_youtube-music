// Quick Controls renderer script
import { createRenderer } from '@/utils';
import type { RendererContext } from '@/types/contexts';
import type { QuickControlsConfig } from './types';

export const renderer = createRenderer<
  {
    ctx?: RendererContext<QuickControlsConfig>;
  },
  QuickControlsConfig
>({
  async start(ctx: RendererContext<QuickControlsConfig>) {
    this.ctx = ctx;

    const checkAndSendLikeStatus = (
      videoId?: string,
      retryCount: number = 0,
    ) => {
      // likeStatus
      const likeButtonRenderer = document.querySelector(
        '#like-button-renderer',
      ) as any;

      if (!likeButtonRenderer) {
        console.warn('[Quick Controls] #like-button-renderer not found');
        return;
      }

      const likeStatus = likeButtonRenderer.likeStatus;
      const isLiked = likeStatus === 'LIKE';

      console.log(
        `[Quick Controls] Like status from renderer: likeStatus="${likeStatus}", isLiked=${isLiked}`,
      );

      if (!likeStatus && retryCount < 3) {
        setTimeout(
          () => {
            checkAndSendLikeStatus(videoId, retryCount + 1);
          },
          500 * (retryCount + 1),
        );
        return;
      }

      console.log(
        `[Quick Controls] Sending like status: videoId=${videoId || 'current'}, isLiked=${isLiked}`,
      );
      ctx.ipc.send('ytmd:like-status-changed', {
        videoId: videoId || 'current',
        isLiked: isLiked,
      });
    };

    ctx.ipc.on('ytmd:get-like-status', (videoId: string) => {
      console.log(
        `[Quick Controls] Received get-like-status request for videoId: ${videoId}`,
      );
      checkAndSendLikeStatus(videoId);

      if (videoId && videoId !== 'startup') {
        console.log(
          '[Quick Controls] Song changed, re-setting up like button listener',
        );
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
      // getState() repeat mode
      const playerBar = document.querySelector<
        HTMLElement & { getState: () => any }
      >('ytmusic-player-bar');

      if (!playerBar || !playerBar.getState) {
        console.warn(
          '[Quick Controls] ytmusic-player-bar or getState not found',
        );
        return;
      }

      const state = playerBar.getState();
      const mode = state?.queue?.repeatMode || 'NONE';

      console.log(
        `[Quick Controls] Repeat mode from player-bar.getState(): ${mode}`,
      );

      ctx.ipc.send('ytmd:repeat-changed', mode);
    };

    const checkShuffleState = () => {
      // shuffle-on
      const playerBar =
        document.querySelector<HTMLElement>('ytmusic-player-bar');

      if (!playerBar) {
        console.warn('[Quick Controls] ytmusic-player-bar not found');
        return;
      }

      const isShuffled =
        playerBar.attributes.getNamedItem('shuffle-on') !== null;

      console.log(
        `[Quick Controls] Shuffle status from player-bar: shuffle-on=${isShuffled}`,
      );

      ctx.ipc.send('ytmd:shuffle-changed', isShuffled);
    };

    setTimeout(checkRepeatState, 3000);
    setTimeout(checkShuffleState, 3000);
    setTimeout(checkAndSendLikeStatus, 3000);

    let lastKnownLikeStatus: string | null = null;
    const checkLikeStatusChange = () => {
      const likeButtonRenderer = document.querySelector(
        '#like-button-renderer',
      ) as any;

      if (!likeButtonRenderer) {
        return;
      }

      const currentStatus = likeButtonRenderer.likeStatus;

      if (
        lastKnownLikeStatus !== null &&
        lastKnownLikeStatus !== currentStatus
      ) {
        console.log(
          `[Quick Controls] Like status changed: ${lastKnownLikeStatus} -> ${currentStatus}`,
        );
        const isLiked = currentStatus === 'LIKE';
        ctx.ipc.send('ytmd:like-status-changed', {
          videoId: 'current',
          isLiked: isLiked,
        });
      }
      lastKnownLikeStatus = currentStatus;
    };

    const setupLikeButtonListener = () => {
      console.log('[Quick Controls] Setting up like button listener...');
      const likeButtonRenderer = document.querySelector(
        '#like-button-renderer',
      ) as any;

      if (!likeButtonRenderer) {
        setTimeout(setupLikeButtonListener, 1000);
        return;
      }

      lastKnownLikeStatus = likeButtonRenderer.likeStatus;

      const buttons = document.querySelectorAll('#like-button-renderer button');
      const likeButton = buttons[0] as HTMLElement;

      if (likeButton) {
        likeButton.addEventListener('click', () => {
          console.log('[Quick Controls] Like button clicked, will update menu');
          setTimeout(() => {
            checkLikeStatusChange();
          }, 300);
        });

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
            if (
              mutation.type === 'attributes' &&
              (mutation.attributeName === 'aria-label' ||
                mutation.attributeName === 'aria-pressed')
            ) {
              setTimeout(checkRepeatState, 100);
            }
          });
        });

        observer.observe(repeatButton, {
          attributes: true,
          attributeFilter: ['aria-label', 'aria-pressed'],
        });

        repeatButton.addEventListener('click', () => {
          setTimeout(checkRepeatState, 500);
        });
      } else {
        setTimeout(setupRepeatButtonListener, 1000);
      }
    };

    let lastKnownRepeatMode: string | null = null;
    const checkRepeatStateChange = () => {
      const playerBar = document.querySelector<
        HTMLElement & { getState: () => any }
      >('ytmusic-player-bar');

      if (!playerBar || !playerBar.getState) {
        return;
      }

      const state = playerBar.getState();
      const currentMode = state?.queue?.repeatMode || 'NONE';

      if (lastKnownRepeatMode !== null && lastKnownRepeatMode !== currentMode) {
        console.log(
          `[Quick Controls] Repeat mode changed: ${lastKnownRepeatMode} -> ${currentMode}`,
        );
        ctx.ipc.send('ytmd:repeat-changed', currentMode);
      }
      lastKnownRepeatMode = currentMode;
    };

    let lastKnownShuffleState: boolean | null = null;
    const checkShuffleStateChange = () => {
      const playerBar =
        document.querySelector<HTMLElement>('ytmusic-player-bar');

      if (!playerBar) {
        return;
      }

      const currentState =
        playerBar.attributes.getNamedItem('shuffle-on') !== null;

      if (
        lastKnownShuffleState !== null &&
        lastKnownShuffleState !== currentState
      ) {
        console.log(
          `[Quick Controls] Shuffle state changed: ${lastKnownShuffleState} -> ${currentState}`,
        );
        ctx.ipc.send('ytmd:shuffle-changed', currentState);
      }
      lastKnownShuffleState = currentState;
    };

    setTimeout(setupLikeButtonListener, 3000);
    setTimeout(setupRepeatButtonListener, 3000);

    setTimeout(() => {
      checkRepeatStateChange();
      setInterval(checkRepeatStateChange, 2000);
    }, 3000);

    setTimeout(() => {
      checkShuffleStateChange();
      setInterval(checkShuffleStateChange, 2000);
    }, 3000);

    setTimeout(() => {
      checkLikeStatusChange();
      setInterval(checkLikeStatusChange, 2000);
    }, 3000);
  },

  stop() {},
});
