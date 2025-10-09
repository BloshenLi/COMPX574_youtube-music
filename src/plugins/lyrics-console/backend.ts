import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { createBackend } from '@/utils';

/* --------------------------- 轻量类型声明 --------------------------- */
interface BackendContext {
  ipc: {
    handle: (channel: string, listener: (...args: unknown[]) => unknown | Promise<unknown>) => void;
    on: (channel: string, listener: (...args: unknown[]) => void) => void;
  };
}

type KaraokePayload = {
  prev?: unknown;
  current?: unknown;
  next?: unknown;
  sub?: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var __lyrics_console_min_running__: boolean | undefined;
}

/* ------------------------------ 运行标志 ------------------------------ */
const FLAG = '__lyrics_console_min_running__' as const;

function getFlag(): boolean {
  return Boolean((globalThis as Record<string, unknown>)[FLAG]);
}
function setFlag(v: boolean) {
  (globalThis as Record<string, unknown>)[FLAG] = v;
}
function delFlag() {
  delete (globalThis as Record<string, unknown>)[FLAG];
}

/* --------------------------- 窗口与布局 --------------------------- */
let overlay: BrowserWindow | null = null;

function positionAtBottom(win: BrowserWindow) {
  const { workArea } = screen.getPrimaryDisplay();
  const [w, h] = win.getSize();
  const x = Math.round(workArea.x + (workArea.width - w) / 2);
  const y = Math.round(workArea.y + workArea.height - h - 10);
  win.setBounds({ x, y, width: w, height: h });
}

function resolveOverlayHtmlPath(): string {
  const p1 = path.join(__dirname, 'overlay.html');
  if (fs.existsSync(p1)) return p1;

  const p2 = path.join(process.cwd(), 'src/plugins/lyrics-console/overlay.html');
  if (fs.existsSync(p2)) return p2;

  return path.resolve('overlay.html');
}

function ensureOverlay(): BrowserWindow {
  if (overlay && !overlay.isDestroyed()) return overlay;

  overlay = new BrowserWindow({
    width: 1120,
    height: 150,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    fullscreenable: false,
    resizable: false,
    movable: true,
    focusable: true,
    acceptFirstMouse: true,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlay.loadFile(resolveOverlayHtmlPath());

  overlay.once('ready-to-show', () => {
    try {
      overlay!.setAlwaysOnTop(true, 'floating');
    } catch {}
    positionAtBottom(overlay!);
    try {
      (overlay as BrowserWindow & { showInactive?: () => void }).showInactive?.();
    } catch {
      overlay!.show();
    }
  });

  overlay.on('closed', () => {
    overlay = null;
    setFlag(false);
  });

  return overlay;
}

/* ----------------------- 与 overlay 的通信 ----------------------- */
async function setLine(text: string) {
  const w = ensureOverlay();
  if (!w || w.isDestroyed()) return;
  await w.webContents.executeJavaScript(
    `window.__setLine(${JSON.stringify(String(text ?? ''))})`,
    true,
  );
}

async function setKaraoke(payload: { prev?: string; current?: string; next?: string; sub?: string }) {
  const w = ensureOverlay();
  if (!w || w.isDestroyed()) return;
  await w.webContents.executeJavaScript(
    `window.__setKaraoke(${JSON.stringify(payload)})`,
    true,
  );
}

/* ------------------------------ 后端主体 ------------------------------ */
export const backend = createBackend({
  async start(ctx: BackendContext) {
    // 防重复启动
    if (getFlag()) return;
    setFlag(true);

    ensureOverlay();
    await setLine('✅ Lyrics console ready');

    // —— 单行文本（兼容 handle / on 两种调用）
    ctx.ipc.handle('lyrics-console:set-line', async (...args: unknown[]) => {
      const raw = args[0];
      const text = String((raw as { text?: unknown } | null)?.text ?? raw ?? '');
      if (!text) return false;
      await setLine(text);
      return true;
    });

    ctx.ipc.on('lyrics-console:set-line', async (...args: unknown[]) => {
      const raw = args[0];
      const text = String((raw as { text?: unknown } | null)?.text ?? raw ?? '');
      if (!text) return;
      await setLine(text);
    });

    // 移动锁定
    ctx.ipc.on('lyrics-console:set-locked', (...args: unknown[]) => {
      const locked = Boolean(args[1] ?? args[0]); // 兼容不同发参
      try {
        const w = ensureOverlay();
        if (!w || w.isDestroyed()) return;
        w.setMovable(!locked);
      } catch {}
    });

    // —— 整句高亮
    ctx.ipc.handle('lyrics-console:set-karaoke', async (...args: unknown[]) => {
      const payload = (args[0] as KaraokePayload) ?? {};
      await setKaraoke({
        prev: String(payload.prev ?? ''),
        current: String(payload.current ?? ''),
        next: String(payload.next ?? ''),
        sub: String(payload.sub ?? ''),
      });
      return true;
    });

    ctx.ipc.on('lyrics-console:set-karaoke', async (...args: unknown[]) => {
      const payload = (args[0] as KaraokePayload) ?? {};
      await setKaraoke({
        prev: String(payload.prev ?? ''),
        current: String(payload.current ?? ''),
        next: String(payload.next ?? ''),
        sub: String(payload.sub ?? ''),
      });
    });

    // —— 主进程代理抓取（避免 CORS；如不需要可删）
    ctx.ipc.handle('lyrics-console:fetch', async (...args: unknown[]) => {
      try {
        const req = args[0];
        const url =
          typeof req === 'string'
            ? req
            : req && typeof req === 'object' && 'url' in (req as Record<string, unknown>)
              ? String((req as Record<string, unknown>).url)
              : '';
        const init =
          req && typeof req === 'object' && 'init' in (req as Record<string, unknown>)
            ? (req as Record<string, unknown>).init
            : undefined;

        if (!url) return { ok: false, status: 0 };

        const r = await (globalThis as { fetch: typeof fetch }).fetch(
          url,
          init as RequestInit | undefined,
        );

        const ct = String(r.headers.get('content-type') || '');
        const body = ct.includes('application/json') ? await r.json() : await r.text();

        return {
          ok: r.ok,
          status: r.status,
          headers: Object.fromEntries(r.headers.entries()),
          body,
        };
      } catch (e) {
        return { ok: false, status: 0, error: String(e) };
      }
    });

    // —— 退出清理
    app.on('before-quit', () => {
      try {
        if (overlay && !overlay.isDestroyed()) overlay.destroy();
      } catch {}
      overlay = null;
      delFlag();
    });
  },

  stop() {
    try {
      if (overlay && !overlay.isDestroyed()) overlay.destroy();
    } catch {}
    overlay = null;
    delFlag();
  },
});

export default backend;
