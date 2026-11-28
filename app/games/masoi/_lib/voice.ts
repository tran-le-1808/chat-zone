/**
 * LUẬT VOICE MA SÓI (theo góc nhìn của mình — chỉ dùng thông tin mình được biết):
 * - Ban ngày / bỏ phiếu / Thợ Săn: người sống nói với cả làng (người chết cũng nghe).
 * - Ban đêm: chỉ bầy Sói nói & nghe nhau; dân đang ngủ — không nói, không nghe.
 * - Người chết: chỉ nói với người chết, nhưng nghe được mọi người.
 * - Hết ván / ngoài ván: ai cũng nói với nhau.
 */
import type { MSView } from "./game";

export interface MSVoiceRule {
  key: string;
  canSend: (userId: string) => boolean;
  canHear: (userId: string) => boolean;
  mic: boolean;
  label: string;
}

export function msVoiceRule(v: MSView, players: string[]): MSVoiceRule {
  const me = v.mySeat;
  const seatOf = (uid: string) => players.indexOf(uid);
  if (v.phase === "over" || me < 0) {
    return { key: `free:${v.phase}`, canSend: () => true, canHear: () => true, mic: true, label: "Cả làng" };
  }
  const night = v.phase === "night" || v.phase === "witch";
  const alive = v.alive[me];
  const wolf = v.myRole === "wolf";
  const isWolf = (s: number) => v.roles[s] === "wolf";
  const key = `${v.phase}:${v.pid}:${v.alive.map((a) => (a ? 1 : 0)).join("")}:${me}`;
  if (!alive)
    return {
      key,
      canSend: (uid) => {
        const s = seatOf(uid);
        return s >= 0 && !v.alive[s];
      },
      canHear: (uid) => seatOf(uid) >= 0,
      mic: true,
      label: "Người chết: chỉ người chết nghe bạn",
    };
  if (night)
    return {
      key,
      canSend: (uid) => {
        const s = seatOf(uid);
        return wolf && s >= 0 && (!v.alive[s] || isWolf(s));
      },
      canHear: (uid) => {
        const s = seatOf(uid);
        return wolf && s >= 0 && v.alive[s] && isWolf(s);
      },
      mic: wolf,
      label: wolf ? "Đêm: chỉ bầy Sói nghe nhau" : "Đêm: bạn đang ngủ",
    };
  return {
    key,
    canSend: (uid) => seatOf(uid) >= 0,
    canHear: (uid) => {
      const s = seatOf(uid);
      return s >= 0 && v.alive[s];
    },
    mic: true,
    label: "Ngày: cả làng",
  };
}
