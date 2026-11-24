"use client";

/** SẢNH CỜ CARO: chơi với bot, ghép trận nhanh, tạo phòng, vào bằng mã, phòng công khai */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Hash, Loader2, Plus, RefreshCw, Swords, Users, X } from "lucide-react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit, waitForSocket } from "@/lib/monopolySocket";
import { ui } from "@/components/ui/styles";
import { RULE_HINT, RULE_LABEL, type CaroRule, type Stone } from "../_lib/rules";
import { CARO_BOT_LEVELS, type CaroBotLevel } from "../_lib/bot";
import type { BotSetup } from "./CaroBotGame";
import type { CaroPublicRoom } from "./online/types";

const RULES: CaroRule[] = ["block2", "free"];
const TURN_OPTIONS = [15, 30, 60];

export default function CaroLobby({ onBot }: { onBot: (s: BotSetup) => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"bot" | "online">("bot");
  // chơi với bot
  const [rule, setRule] = useState<CaroRule>("block2");
  const [level, setLevel] = useState<CaroBotLevel>("medium");
  const [human, setHuman] = useState<Stone>(1);
  // online
  const [rooms, setRooms] = useState<CaroPublicRoom[]>([]);
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<{ rule: CaroRule; since: number } | null>(null);
  const [now, setNow] = useState(0);
  const [roomRule, setRoomRule] = useState<CaroRule>("block2");
  const [turnSeconds, setTurnSeconds] = useState(30);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await waitForSocket())) return;
    const r = await monoEmit<CaroPublicRoom[]>("caro:list");
    if (r.ok) setRooms(r.data ?? []);
  }, []);

  useEffect(() => {
    if (tab !== "online") return;
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), 8000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [tab, refresh]);

  useEffect(() => {
    const onMatched = ({ code }: { code: string }) => {
      setQueue(null);
      toast.success("Đã tìm thấy đối thủ!");
      router.push(`/games/caro/room/${code}`);
    };
    socket.on("caro:matched", onMatched);
    return () => {
      socket.off("caro:matched", onMatched);
    };
  }, [router]);

  // rời trang khi đang chờ ghép -> huỷ hàng chờ
  useEffect(() => () => void monoEmit("caro:quick:cancel"), []);

  useEffect(() => {
    if (!queue) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queue]);

  const quick = useCallback(async (r: CaroRule) => {
    if (!(await waitForSocket())) return toast.error("Chưa kết nối được máy chủ");
    const res = await monoEmit<{ waiting: number }>("caro:quick", { rule: r });
    if (!res.ok) return toast.error(res.error ?? "Không vào hàng chờ được");
    const since = Date.now();
    setNow(since);
    setQueue({ rule: r, since });
  }, []);
  const cancel = async () => {
    await monoEmit("caro:quick:cancel");
    setQueue(null);
  };
  const create = async () => {
    setBusy(true);
    const r = await monoEmit<{ room: { code: string } }>("caro:create", { rule: roomRule, turnSeconds, isPrivate });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.error ?? "Không tạo được phòng");
    router.push(`/games/caro/room/${r.data.room.code}`);
  };

  const chip = (on: boolean) => `rounded-xl border px-3 py-2 text-sm font-bold transition ${on ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"}`;
  const label = "text-xs font-bold uppercase tracking-wide text-slate-400";
  const waited = queue ? Math.max(0, Math.round((now - queue.since) / 1000)) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 text-slate-100">
      <div>
        <h1 className="text-2xl font-black">Cờ Caro</h1>
        <p className="text-sm text-slate-400">Bàn 20×20 · 5 quân liền trở lên là thắng</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={chip(tab === "bot")} onClick={() => setTab("bot")}>
          <Bot className="mr-1 inline h-4 w-4" /> Chơi với bot
        </button>
        <button type="button" className={chip(tab === "online")} onClick={() => setTab("online")}>
          <Swords className="mr-1 inline h-4 w-4" /> Chơi online
        </button>
      </div>

      {/* luật (dùng cho bot và ghép trận) */}
      {tab === "bot" && (
        <section className={`${ui.card} space-y-4 p-4`}>
          <div className="space-y-2">
            <p className={label}>Thể loại</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {RULES.map((r) => (
                <button key={r} type="button" className={`${chip(rule === r)} text-left`} onClick={() => setRule(r)}>
                  {RULE_LABEL[r]}
                  <span className="block text-[11px] font-medium text-slate-400">{RULE_HINT[r]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className={label}>Độ khó bot</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CARO_BOT_LEVELS) as CaroBotLevel[]).map((l) => (
                <button key={l} type="button" className={chip(level === l)} onClick={() => setLevel(l)}>{CARO_BOT_LEVELS[l]}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className={label}>Bạn cầm</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(human === 1)} onClick={() => setHuman(1)}>X (đi trước)</button>
              <button type="button" className={chip(human === 2)} onClick={() => setHuman(2)}>O (bot đi trước)</button>
            </div>
          </div>
          <button type="button" className={`${ui.btnPrimary} w-full`} onClick={() => onBot({ rule, level, human })}>
            Bắt đầu
          </button>
        </section>
      )}

      {tab === "online" && (
        <div className="space-y-4">
          {/* ghép trận nhanh */}
          <section className="grid gap-2 sm:grid-cols-2">
            {RULES.map((r) => (
              <button key={r} type="button" disabled={!!queue} onClick={() => void quick(r)} className="flex items-center gap-3 rounded-2xl border border-[#f4b942]/30 bg-[#f4b942]/10 p-3 text-left transition hover:bg-[#f4b942]/20 disabled:opacity-50">
                <Swords className="h-8 w-8 shrink-0 text-[#ffd166]" />
                <span className="min-w-0">
                  <b className="block">Ghép trận · {RULE_LABEL[r]}</b>
                  <span className="text-xs text-slate-400">{RULE_HINT[r]} · 30 giây/nước</span>
                </span>
              </button>
            ))}
          </section>
          {queue && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-[#ffd166]" />
              <span className="flex-1">Đang tìm đối thủ ({RULE_LABEL[queue.rule]})… {waited}s</span>
              <button type="button" onClick={() => void cancel()} className={`${ui.btnGhost} px-2! py-1! text-xs`}>
                <X className="h-4 w-4" /> Huỷ
              </button>
            </div>
          )}

          {/* tạo phòng */}
          <section className={`${ui.card} space-y-3 p-4`}>
            <p className={label}>Tạo phòng</p>
            <div className="flex flex-wrap gap-2">
              {RULES.map((r) => (
                <button key={r} type="button" className={chip(roomRule === r)} onClick={() => setRoomRule(r)}>{RULE_LABEL[r]}</button>
              ))}
              {TURN_OPTIONS.map((s) => (
                <button key={s} type="button" className={chip(turnSeconds === s)} onClick={() => setTurnSeconds(s)}>{s}s/nước</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Phòng riêng (chỉ vào bằng mã)
            </label>
            <button type="button" onClick={() => void create()} disabled={busy} className={`${ui.btnPrimary} w-full`}>
              <Plus className="h-4 w-4" /> Tạo phòng
            </button>
          </section>

          <form
            className={`${ui.field} py-1.5!`}
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length === 6) router.push(`/games/caro/room/${c}`);
              else toast.error("Mã phòng gồm 6 ký tự");
            }}
          >
            <Hash className="h-4 w-4 shrink-0 text-[#f4b942]" />
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Nhập mã phòng" aria-label="Mã phòng" className="w-full min-w-0 bg-transparent font-mono tracking-widest text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500" />
            <button type="submit" className="shrink-0 rounded-lg bg-[#f4b942] px-3 py-1 text-sm font-bold text-[#1a1206]">Vào</button>
          </form>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className={label}>Phòng công khai</span>
              <button type="button" onClick={() => void refresh()} aria-label="Làm mới" className="rounded-lg p-1 text-slate-400 hover:text-white">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Chưa có phòng nào — hãy tạo phòng hoặc ghép trận</p>
            ) : (
              <ul className="space-y-1.5">
                {rooms.map((r) => (
                  <li key={r.code} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="font-mono text-xs tracking-widest text-[#ffd166]">{r.code}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {RULE_LABEL[r.settings.rule]} · {r.settings.turnSeconds}s · {r.players.map((p) => p.name).join(" vs ")}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Users className="h-3.5 w-3.5" /> {r.players.length}/2
                    </span>
                    <button type="button" disabled={r.status !== "lobby" || r.players.length >= 2} onClick={() => router.push(`/games/caro/room/${r.code}`)} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold hover:bg-white/20 disabled:opacity-40">
                      {r.status === "lobby" ? "Vào" : "Đang đấu"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
