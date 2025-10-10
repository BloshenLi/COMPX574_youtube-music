/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { createRenderer } from '@/utils';

type TimedLine = { t: number; end: number; text: string };
type LrcLine = { t: number; end?: number; text: string };

interface YtTimedLyric {
  cueRange?: {
    startTimeMilliseconds?: string | number;
    endTimeMilliseconds?: string | number;
  };
  startTimeMs?: string | number;
  endTimeMs?: string | number;
  lyricLine?: string;
  text?: string;
}

interface RendererContext {
  ipc: { invoke: (channel: string, ...args: unknown[]) => Promise<any> };
}

declare global {
  interface Window {
    __lyrics_console_renderer_cleanup__?: () => void;
    __lrcGetTime?: () => { t: number; seeking: boolean };
  }
}

const POLL_MS = 2000;
const TICK_MS = 120;
const PRELUDE = 0.6;
const OFFSET = 0.0;
const EPS = 0.04;

const safe = (s: unknown): string => String((s as any) ?? '').trim();

/* ---------------- 读取当前播放歌曲 ---------------- */
function readNowPlaying() {
  const app = document.querySelector('ytmusic-app') as any;
  const pr = app?.playerApi?.getPlayerResponse?.();
  const vd = pr?.videoDetails || {};
  let title = safe(vd.title);
  let artist = safe(vd.author);
  const videoId = safe(vd.videoId);

  const bar = document.querySelector('ytmusic-player-bar');
  if (bar) {
    const tn = bar.querySelector(
      '.title,#song-title,yt-formatted-string.title,#primary-title',
    );
    if (!title) {
      const t =
        (tn && ('getAttribute' in tn ? tn.getAttribute('title') : null)) ??
        tn?.textContent ??
        '';
      title = safe(t);
    }

    const by = bar.querySelector(
      '.byline,#subtitle,yt-formatted-string.byline',
    );
    if (by) {
      const a = by.querySelector('a[href]');
      const raw = safe(
        (a && ('getAttribute' in a ? a.getAttribute('title') : null)) ??
          a?.textContent ??
          by.textContent ??
          '',
      );
      artist = raw.includes('•') ? safe(raw.split('•')[0]) : raw;
    }
  }

  const docTitle = safe(document.title || '');
  if (!title && docTitle.includes(' - ')) {
    title = safe(docTitle.split(' - ')[0]);
  }

  return {
    videoId,
    title,
    artist,
    meta: (artist ? `${title} — ${artist}` : title) || 'YouTube Music',
  };
}

function getDurationSec(): number {
  try {
    const app: any = document.querySelector('ytmusic-app');
    const pr: any = app?.playerApi?.getPlayerResponse?.();
    const len = Number(pr?.videoDetails?.lengthSeconds || 0);
    return Number.isFinite(len) ? len : 0;
  } catch {
    return 0;
  }
}

function parseEnhancedLRC(raw: string): LrcLine[] {
  if (!raw) return [];
  const out: LrcLine[] = [];
  for (const l of raw.split(/\r?\n/)) {
    const m = l.match(/^\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\](.*)$/);
    if (!m) continue;
    const t = Number(m[1]) * 60 + Number(m[2]) + Number(m[3] || 0) / 1000;
    const text = safe(m[4] || '');
    if (!text) continue;
    out.push({ t, text });
  }
  out.sort((a, b) => a.t - b.t);
  for (let i = 0; i < out.length; i++) {
    if (!out[i].end)
      out[i].end = i + 1 < out.length ? out[i + 1].t : out[i].t + 5;
  }
  return out;
}

/* ---------------- 官方歌词（行级时间） ---------------- */
async function fetchYtTimedLyrics(): Promise<TimedLine[] | null> {
  try {
    const app: any = document.querySelector('ytmusic-app');
    if (!app?.networkManager) return null;
    const pr = app.playerApi?.getPlayerResponse?.();
    const vid = pr?.videoDetails?.videoId;
    if (!vid) return null;

    const next = await app.networkManager.fetch('/next?prettyPrint=false', { videoId: vid });
    const tabs =
      next?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
        ?.watchNextTabbedResultsRenderer;
    const list: any[] | null = Array.isArray(tabs?.tabs) ? tabs.tabs : null;
    if (!list) return null;

    let browseId: string | null = null;
    for (const it of list) {
      const cfg = it?.tabRenderer?.endpoint?.browseEndpoint
        ?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig;
      if (cfg?.pageType === 'MUSIC_PAGE_TYPE_TRACK_LYRICS') {
        browseId = it?.tabRenderer?.endpoint?.browseEndpoint?.browseId ?? null;
        break;
      }
    }
    if (!browseId) return null;

    const data = await app.networkManager.fetch('/browse?prettyPrint=false', { browseId });
    const synced = data?.contents?.elementRenderer?.newElement;

    const arr = (
      synced?.type?.componentType?.model?.timedLyricsModel?.lyricsData?.timedLyricsData
    ) as YtTimedLyric[] | null;

    if (!Array.isArray(arr) || !arr.length) return null;

    return arr.map(
      (it): TimedLine => ({
        t:
          Number(it?.cueRange?.startTimeMilliseconds ?? it?.startTimeMs ?? 0) /
          1000,
        end:
          Number(it?.cueRange?.endTimeMilliseconds ?? it?.endTimeMs ?? 0) /
          1000,
        text: safe(it?.lyricLine ?? it?.text ?? ''),
      }),
    );
  } catch {
    return null;
  }
}

/* ---------------- LRCLib 兜底（主进程代理 fetch） ---------------- */
async function fetchLRCLib(ctx: RendererContext, title: string, artist: string): Promise<string> {
  const base = 'https://lrclib.net/api/search?';
  const dur = getDurationSec();
  const queries = [
    new URLSearchParams({
      track_name: title,
      artist_name: artist,
      track_duration: String(dur),
    }).toString(),
    new URLSearchParams({ track_name: title, artist_name: artist }).toString(),
    new URLSearchParams({ track_name: title }).toString(),
  ];
  for (const qs of queries) {
    const url = base + qs;
    const r = await ctx.ipc.invoke('lyrics-console:fetch', url);
    if ((r as any)?.ok && (r as any)?.body) {
      const arr = Array.isArray((r as any).body) ? (r as any).body : [];
      if (!arr.length) continue;
      const pick = arr
        .map((it: any) => ({ it, d: Math.abs(Number(it?.duration || 0) - dur) }))
        .sort((a: any, b: any) => a.d - b.d)[0]?.it;
      const text = pick?.syncedLyrics || pick?.plainLyrics || '';
      if (text) return text as string;
    }
  }
  return '';
}

function installTimeProbe() {
  if (window.__lrcGetTime) return;
  let stable = 0,
    seeking = false;
  function attach() {
    const v: HTMLVideoElement | null = document.querySelector('video');
    if (!v) return false;
    v.addEventListener('timeupdate', () => {
      stable = v.currentTime;
    });
    v.addEventListener('seeking', () => {
      seeking = true;
    });
    v.addEventListener('seeked', () => {
      seeking = false;
    });
    window.__lrcGetTime = () => ({ t: stable, seeking });
    return true;
  }
  if (!attach()) {
    const id = setInterval(() => {
      if (attach()) clearInterval(id);
    }, 500);
  }
}

/* ---------------- 入口：整句高亮 ---------------- */
export default createRenderer({
  async start(ctx: RendererContext) {
    installTimeProbe();
    setTimeout(async () => {
      try { await ctx.ipc.invoke('lyrics-console:set-line', '✅ Lyrics console ready'); } catch {}
    }, 300);

    let curKey = '';
    let lines: LrcLine[] = [];
    let curLineIdx = -1;

    // 系统性偏移自适应（切行时估计）
    let bias = 0;
    let biasReady = false;
    const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
    const smooth = (prev: number, cur: number) => prev * 0.7 + cur * 0.3;

    async function refreshOnce() {
      const np = readNowPlaying();
      if (!np.videoId && !np.title) return;

      const key = np.videoId
        ? `vid:${np.videoId}`
        : `ta:${np.title}::${np.artist}`;
      if (key !== curKey) {
        curKey = key;
        lines = [];
        curLineIdx = -1;
        bias = 0;
        biasReady = false;

        try {
          await ctx.ipc.invoke('lyrics-console:set-line', np.meta);
        } catch {}

        // 1) 官方同步（行级）
        const yt = await fetchYtTimedLyrics();
        if (yt && yt.length) {
          lines = yt
            .filter((x) => safe(x.text) && x.end > x.t)
            .map((x) => ({ t: x.t, end: x.end, text: x.text }));
          return;
        }

        // 2) LRCLib
        const raw = await fetchLRCLib(ctx, np.title, np.artist);
        const parsed = parseEnhancedLRC(raw);
        if (parsed.length) {
          lines = parsed;
          return;
        }

        // 3) 无歌词
        try {
          await ctx.ipc.invoke(
            'lyrics-console:set-line',
            np.meta + '\n(No lyrics)',
          );
        } catch {}
      }
    }

    const tick = async () => {
      await refreshOnce();
      if (!lines.length) return;

      const get = window.__lrcGetTime;
      const g = typeof get === 'function' ? get() : { t: 0, seeking: false };

      // 逻辑时间：当前播放时间 + 视觉偏移 - 全局校准偏移
      const now = g.t + OFFSET - (biasReady ? bias : 0);

      if (now < lines[0].t - PRELUDE) return;

      // 找当前行（超出尾部固定最后一行）
      let li = lines.findIndex(l => now >= l.t - EPS && now < (l.end ?? Infinity) + EPS);
      if (li < 0) li = lines.length - 1;

      // 切行：只发送整句
      if (li !== curLineIdx) {
        curLineIdx = li;

        // 估计系统性偏移（以行起点为参照）
        const estimate = clamp(g.t + OFFSET - lines[li].t, -0.25, 0.25);
        bias = biasReady ? smooth(bias, estimate) : estimate;
        biasReady = true;

        try {
          await ctx.ipc.invoke('lyrics-console:set-karaoke', {
            prev: li > 0 ? lines[li - 1].text : '',
            current: lines[li].text,
            next: li + 1 < lines.length ? lines[li + 1].text : '',
            sub: '',
          });
        } catch {}
      }
    };

    const timer = setInterval(tick, TICK_MS);
    const poller = setInterval(refreshOnce, POLL_MS);
    window.__lyrics_console_renderer_cleanup__ = () => {
      clearInterval(timer);
      clearInterval(poller);
    };
  },

  stop() {
    try {
      window.__lyrics_console_renderer_cleanup__?.();
    } catch {}
  },
});
