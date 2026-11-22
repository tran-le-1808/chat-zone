/**
 * Phiên chơi cục bộ: trận LocalCaromMatch + "transport" cho lõi game (giống server) + bot tự đánh khi tới lượt.
 * Không gửi gì lên server; dọn hẹn giờ / huỷ bot khi rời trang.
 */
import type { BilliardTransport } from "../../_context/BilliardGameContext";
import { LocalCaromMatch, type LocalKind } from "../../_lib/practice/localMatch";
import { BOT_LEVELS, chooseBotShot, type BotLevel } from "../../_lib/practice/bot";
import type { CaromMode } from "../../_lib/physics";

export interface LocalSessionOptions {
  kind: LocalKind;
  mode: CaromMode;
  target: number;
  level: BotLevel;
  me: string;
}

export interface LocalSession {
  engine: LocalCaromMatch;
  transport: BilliardTransport;
  /** Bot đang tính cú đánh */
  thinking: () => boolean;
  onThinking: (fn: (v: boolean) => void) => () => void;
  dispose: () => void;
}

export const BOT_ID = "bot";

export function createLocalSession(o: LocalSessionOptions): LocalSession {
  const engine = new LocalCaromMatch({ kind: o.kind, mode: o.mode, target: o.target, me: o.me, bot: BOT_ID });
  let thinking = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abort: AbortController | null = null;
  let disposed = false;
  const thinkListeners = new Set<(v: boolean) => void>();
  const setThinking = (v: boolean) => {
    thinking = v;
    thinkListeners.forEach((fn) => fn(v));
  };

  const transport: BilliardTransport = {
    subscribe: (apply) => engine.subscribe(apply),
    async shoot(cmd) {
      // tự luyện: luôn là lượt mình (ghế = bi cái đang chọn); đấu bot: mình là ghế 0
      const by = o.kind === "practice" ? engine.match.turn : 0;
      return engine.shoot(cmd, by);
    },
    myIndex: (m) => (o.kind === "practice" ? m.turn : 0),
  };

  // bot: tới lượt (ghế 1) và bàn đã yên -> nghĩ -> đánh bằng chính trận cục bộ
  const unsub =
    o.kind === "bot"
      ? engine.subscribe((m) => {
          if (disposed || m.turn !== 1 || m.winner !== null) return;
          if (timer) clearTimeout(timer);
          const seq = m.seq;
          const wait = Math.max(0, m.busyUntil - Date.now()) + BOT_LEVELS[o.level].thinkMs;
          timer = setTimeout(async () => {
            timer = null;
            if (disposed || engine.match.seq !== seq) return;
            abort?.abort();
            const ctl = new AbortController();
            abort = ctl;
            setThinking(true);
            try {
              const choice = await chooseBotShot(engine.match.balls, 1, o.mode, o.level, seq * 7919 + 13, { signal: ctl.signal });
              if (!choice || disposed || ctl.signal.aborted || engine.match.seq !== seq) return;
              let res = engine.shoot(choice.shot, 1);
              // cơ vướng sau khi run tay: nâng cơ rồi đánh lại cú dự định
              if (!res.ok) res = engine.shoot({ ...choice.planned, elevation: 30 }, 1);
              if (!res.ok) res = engine.shoot({ ...choice.planned, elevation: 60, power: 0.3 }, 1);
            } finally {
              if (abort === ctl) abort = null;
              setThinking(false);
            }
          }, wait);
        })
      : () => {};

  return {
    engine,
    transport,
    thinking: () => thinking,
    onThinking(fn) {
      thinkListeners.add(fn);
      return () => thinkListeners.delete(fn);
    },
    dispose() {
      disposed = true;
      unsub();
      if (timer) clearTimeout(timer);
      abort?.abort();
      thinkListeners.clear();
    },
  };
}
