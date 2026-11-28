"use client";

/** Phòng Vẽ Đoán online: kết nối / lỗi / phòng chờ (cài đặt, từ tự nhập) / bàn chơi */
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Copy, Crown, MessageCircle, UserX } from "lucide-react";
import { toast } from "sonner";
import { monoEmit } from "@/lib/monopolySocket";
import GameChat from "../../../monopoly/_components/GameChat";
import VoiceControls, { VoiceBadge } from "../../../monopoly/_components/VoiceControls";
import { useRoom } from "../../../monopoly/_context/RoomContext";
import { VoiceProvider } from "../../../monopoly/_context/VoiceContext";
import { CARD, font, hand, PAGE_BG, PLAYER_COLORS, VD } from "../theme";
import { DRAW_OPTIONS, ROUND_OPTIONS, VD_MAX_PLAYERS, type VDRoomSettingsPublic } from "./types";
import VDGame from "./VDGame";

function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-white" style={PAGE_BG}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
      <p className="text-sm font-bold opacity-80">{text}</p>
    </div>
  );
}

const chatTrigger = ({ onClick, unread }: { onClick: () => void; unread: number }) => (
  <button type="button" onClick={onClick} aria-label="Mở chat" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/15 text-white hover:bg-white/25">
    <MessageCircle className="h-4 w-4" />
    {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff5d5d] px-1 text-[9px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}
  </button>
);

export default function VeDoanRoomScreen() {
  const { room, uiStatus, error, gameSession } = useRoom();
  if (uiStatus === "connecting" || (!room && uiStatus !== "error")) return <Loading text="Đang vào lớp vẽ…" />;
  if (uiStatus === "error" || !room)
    return (
      <div className="flex min-h-dvh items-center justify-center p-4" style={PAGE_BG}>
        <div className="w-full max-w-sm space-y-4 rounded-3xl p-6 text-center" style={CARD}>
          <h2 className="text-xl font-black">Không thể vào phòng</h2>
          <p className="text-sm">{error}</p>
          <Link href="/games/vedoan" className="block rounded-xl px-4 py-2.5 font-bold text-white" style={{ background: VD.blue }}>
            Về sảnh Vẽ Đoán
          </Link>
        </div>
      </div>
    );
  return <VoiceProvider>{room.status === "lobby" ? <WaitingRoom /> : <VDGame key={gameSession} />}</VoiceProvider>;
}

function Opt({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="rounded-xl py-2 text-sm font-black transition disabled:cursor-default" style={{ background: on ? VD.yellow : "#fff", border: `2.5px solid ${on ? VD.ink : "rgba(31,42,68,.2)"}`, boxShadow: on ? `2px 2px 0 ${VD.ink}` : "none" }}>
      {children}
    </button>
  );
}

function WaitingRoom() {
  const { room, me, isHost, myUserId, code, setReady, startGame, updateSettings, kickPlayer, leaveRoom } = useRoom();
  const [copied, setCopied] = useState(false);
  const [words, setWords] = useState<string | null>(null);
  if (!room) return null;
  const st = room.settings as unknown as VDRoomSettingsPublic;
  const players = room.players as unknown as { userId: string; name: string; seat: number; ready: boolean; connected: boolean }[];
  const canStart = isHost && players.length >= 2 && players.every((p) => p.userId === room.hostId || (p.ready && p.connected));

  const openWords = async () => {
    const r = await monoEmit<{ customWords: string[] }>("vd:words");
    setWords(r.ok && r.data ? r.data.customWords.join("\n") : "");
  };
  const saveWords = async () => {
    const r = await monoEmit<{ customWords: string[] }>("vd:settings", { customText: words ?? "" });
    if (!r.ok) return toast.error(r.error ?? "Không lưu được");
    toast.success(`Đã lưu ${r.data?.customWords.length ?? 0} từ`);
    setWords(null);
  };

  return (
    <div className={`${font.className} min-h-dvh p-4 text-white`} style={PAGE_BG}>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void leaveRoom()} className="inline-flex items-center gap-1 rounded-xl border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-bold">
            <ArrowLeft className="h-4 w-4" /> Rời phòng
          </button>
          <h1 className={`${hand.className} text-2xl`}>Phòng Vẽ Đoán</h1>
          <div className="ml-auto flex items-center gap-2">
            <VoiceControls variant="lobby" />
            <GameChat variant="modal" trigger={chatTrigger} />
          </div>
        </div>
        <div className="space-y-4 rounded-3xl p-4 sm:p-5" style={CARD}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: "#fff8dc", border: `2.5px dashed ${VD.ink}` }}
          >
            <span className="text-xs font-bold opacity-70">Mã phòng (gửi cho bạn bè)</span>
            <span className="flex items-center gap-2 font-mono text-xl font-black tracking-[0.3em]" style={{ color: VD.blue }}>
              {code} {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 opacity-60" />}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: VD_MAX_PLAYERS }, (_, seat) => {
              const p = players.find((x) => x.seat === seat);
              return (
                <div key={seat} className="flex min-h-[52px] items-center gap-2 rounded-2xl px-2.5 py-2" style={{ background: p ? "#fff" : "rgba(31,42,68,.04)", border: `2px ${p ? "solid" : "dashed"} ${p ? VD.ink : "rgba(31,42,68,.2)"}` }}>
                  {p ? (
                    <>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: PLAYER_COLORS[seat % PLAYER_COLORS.length] }}>
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-sm font-black">
                          <span className="truncate">{p.name}</span>
                          {p.userId === room.hostId && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          <VoiceBadge userId={p.userId} size="xs" />
                        </p>
                        <p className="truncate text-[11px] font-bold opacity-60">{p.userId === myUserId ? "Bạn" : !p.connected ? "mất kết nối" : p.userId === room.hostId ? "Chủ phòng" : p.ready ? "✅ Sẵn sàng" : "Chưa sẵn sàng"}</p>
                      </div>
                      {isHost && p.userId !== myUserId && (
                        <button type="button" title="Mời ra" onClick={() => void kickPlayer(p.userId)} className="rounded-lg p-1 opacity-50 hover:bg-rose-100 hover:text-rose-700 hover:opacity-100">
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs font-bold opacity-40">Trống</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-sm font-black">Số vòng {isHost ? "" : "(chủ phòng chỉnh)"}</p>
              <div className="grid grid-cols-4 gap-2">
                {ROUND_OPTIONS.map((r) => (
                  <Opt key={r} on={st.rounds === r} disabled={!isHost} onClick={() => void updateSettings({ rounds: r })}>
                    {r} vòng
                  </Opt>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-black">Thời gian vẽ</p>
              <div className="grid grid-cols-4 gap-2">
                {DRAW_OPTIONS.map((s) => (
                  <Opt key={s} on={st.drawSeconds === s} disabled={!isHost} onClick={() => void updateSettings({ drawSeconds: s })}>
                    {s}s
                  </Opt>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" disabled={!isHost} className="h-4 w-4 accent-[#3a86ff]" checked={st.hints} onChange={(e) => void updateSettings({ hints: e.target.checked })} />
              Gợi ý chữ cái (lộ dần khi còn ít thời gian)
            </label>
            <div className="rounded-2xl p-3" style={{ background: "#f3f7ff", border: "2px solid rgba(31,42,68,.15)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black">Từ tự nhập: {st.customCount} từ</p>
                {isHost && words === null && (
                  <button type="button" onClick={() => void openWords()} className="ml-auto rounded-lg bg-white px-2.5 py-1 text-xs font-black" style={{ border: `2px solid ${VD.ink}` }}>
                    Sửa danh sách
                  </button>
                )}
              </div>
              {words !== null && (
                <div className="mt-2 space-y-2">
                  <textarea value={words} onChange={(e) => setWords(e.target.value)} rows={5} placeholder={"Mỗi dòng (hoặc dấu phẩy) một từ, vd:\nbánh mì\ntrà đá\ncon mèo nhà Lan"} className="w-full rounded-xl border-2 border-[#1f2a44]/25 bg-white p-2 text-sm font-semibold outline-none focus:border-[#3a86ff]" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void saveWords()} className="rounded-lg px-3 py-1.5 text-xs font-black text-white" style={{ background: VD.blue }}>
                      Lưu
                    </button>
                    <button type="button" onClick={() => setWords(null)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold" style={{ border: "2px solid rgba(31,42,68,.2)" }}>
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
              <label className="mt-2 flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" disabled={!isHost || st.customCount < 3} className="h-4 w-4 accent-[#3a86ff]" checked={st.onlyCustom} onChange={(e) => void updateSettings({ onlyCustom: e.target.checked })} />
                Chỉ dùng từ tự nhập {st.customCount < 3 ? "(cần ≥ 3 từ)" : ""}
              </label>
            </div>
          </div>

          {isHost ? (
            <button type="button" disabled={!canStart} onClick={() => void startGame()} className={`${hand.className} w-full rounded-xl py-3 text-2xl text-white disabled:opacity-50`} style={{ background: VD.red, border: `3px solid ${VD.ink}`, boxShadow: `4px 4px 0 ${VD.ink}` }}>
              {players.length < 2 ? "Cần ít nhất 2 người" : canStart ? "🎨 Bắt đầu vẽ!" : "Chờ mọi người sẵn sàng"}
            </button>
          ) : (
            <button type="button" onClick={() => void setReady(!me?.ready)} className={`${hand.className} w-full rounded-xl py-3 text-2xl text-white`} style={{ background: me?.ready ? "#6c757d" : VD.green, border: `3px solid ${VD.ink}`, boxShadow: `4px 4px 0 ${VD.ink}` }}>
              {me?.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
