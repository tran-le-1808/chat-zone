"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DoorOpen, Lock, Plus, RefreshCw, Search } from "lucide-react";
import type { RoomInfo } from "@/types/monopoly-room";
import { useLobby } from "../../_context/BilliardLobbyContext";
import { bidaEmit, rememberRoomPassword } from "../../_lib/lobbyApi";
import type { BilliardRoomExtra } from "../../_lib/lobbyTypes";
import { ALLOWED_TARGETS, MODE_LABEL, type BilliardSettings } from "../../_lib/types";
import type { CaromMode } from "../../_lib/physics";
import { Empty, ErrorBox, inputCls, labelCls, Loading, Modal } from "./ui";

type ListedRoom = RoomInfo & BilliardRoomExtra & { settings: BilliardSettings & { name: string; turnSeconds: number } };
const CODE_RE = /^[A-Z0-9]{6}$/;

function RoomList({ onJoin }: { onJoin: (code: string, hasPassword: boolean) => void }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [mode, setMode] = useState<"" | CaromMode>("");
  const [status, setStatus] = useState<"" | "lobby" | "playing">("lobby");
  const [sort, setSort] = useState<"newest" | "players">("newest");
  const [rooms, setRooms] = useState<ListedRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setRefreshing(true);
    const q: Record<string, string> = { sort };
    if (debounced) q.search = debounced;
    if (mode) q.mode = mode;
    if (status) q.status = status;
    const res = await bidaEmit<ListedRoom[]>("bida:list", q);
    setRefreshing(false);
    if (res.ok) {
      setRooms(res.data ?? []);
      setError(null);
    } else setError(res.error ?? "Không tải được danh sách phòng");
  }, [debounced, mode, status, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = setInterval(() => void load(), 10000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <label className="flex min-w-40 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên phòng, chủ phòng, mã…" className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
        <select value={mode} onChange={(e) => setMode(e.target.value as "" | CaromMode)} className="rounded-xl border border-white/10 bg-[#1a1d36] px-2 text-sm">
          <option value="">Mọi luật</option>
          <option value="free">{MODE_LABEL.free}</option>
          <option value="three">{MODE_LABEL.three}</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | "lobby" | "playing")} className="rounded-xl border border-white/10 bg-[#1a1d36] px-2 text-sm">
          <option value="">Mọi trạng thái</option>
          <option value="lobby">Đang chờ</option>
          <option value="playing">Đang chơi</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "players")} className="rounded-xl border border-white/10 bg-[#1a1d36] px-2 text-sm">
          <option value="newest">Mới nhất</option>
          <option value="players">Nhiều người</option>
        </select>
        <button type="button" onClick={() => void load()} className="rounded-xl bg-white/10 px-3" aria-label="Làm mới">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      {rooms === null && !error ? <Loading /> : error ? <ErrorBox text={error} onRetry={() => void load()} /> : !rooms?.length ? (
        <Empty text="Không có phòng nào phù hợp — hãy tạo phòng mới" />
      ) : (
        <div className="max-h-[45dvh] space-y-1.5 overflow-y-auto pr-1">
          {rooms.map((r) => {
            const full = r.players.length >= 2;
            const playing = r.status !== "lobby";
            return (
              <div key={r.code} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    {r.hasPassword && <Lock className="h-3.5 w-3.5 text-[#ffd166]" />}
                    {r.settings.name || `Phòng ${r.code}`}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    Chủ phòng: {r.hostName} · {r.code}
                  </p>
                </div>
                <p className="hidden text-xs text-slate-300 sm:block">
                  {MODE_LABEL[r.settings.mode]} · {r.settings.target} điểm
                </p>
                <p className="hidden text-xs sm:block">
                  <span className="font-bold">{r.players.length}/2</span> · <span className={playing ? "text-red-300" : "text-emerald-300"}>{playing ? "Đang chơi" : "Đang chờ"}</span>
                </p>
                <button type="button" disabled={full || playing} onClick={() => onJoin(r.code, r.hasPassword)} className="rounded-xl bg-[#f4b942]/15 px-3 py-2 text-sm font-bold text-[#ffd166] disabled:opacity-40">
                  {playing ? "Đang chơi" : full ? "Đầy" : "Vào"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateRoomForm({ onCreated }: { onCreated: (code: string) => void }) {
  const { profile, config, mm } = useLobby();
  const searching = mm.state !== "idle";
  const [name, setName] = useState("");
  const [mode, setMode] = useState<CaromMode>("free");
  const [target, setTarget] = useState(10);
  const [isPrivate, setPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [turnSeconds, setTurn] = useState(45);
  const [guideline, setGuideline] = useState(true);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (isPrivate && password && (password.length < 3 || password.length > 32)) return toast.error("Mật khẩu 3–32 ký tự");
    setBusy(true);
    const res = await bidaEmit<{ room: RoomInfo }>("bida:create", {
      name: name.trim() || `Phòng của ${profile?.name ?? "tôi"}`,
      mode,
      target,
      isPrivate,
      turnSeconds,
      guideline,
      ...(isPrivate && password ? { password } : {}),
    });
    setBusy(false);
    if (!res.ok || !res.data) return toast.error(res.error ?? "Không tạo được phòng");
    if (isPrivate && password) rememberRoomPassword(res.data.room.code, password);
    onCreated(res.data.room.code);
  };
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Tên phòng</label>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={`Phòng của ${profile?.name ?? "tôi"}`} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Luật chơi</label>
          <select value={mode} onChange={(e) => { const m = e.target.value as CaromMode; setMode(m); setTarget(ALLOWED_TARGETS[m][1]); }} className={inputCls}>
            <option value="free">{MODE_LABEL.free}</option>
            <option value="three">{MODE_LABEL.three}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Điểm thắng</label>
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))} className={inputCls}>
            {ALLOWED_TARGETS[mode].map((t) => (
              <option key={t} value={t}>{t} điểm</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Thời gian lượt</label>
          <select value={turnSeconds} onChange={(e) => setTurn(Number(e.target.value))} className={inputCls}>
            {(config?.turnSecondsOptions ?? [45]).map((s) => (
              <option key={s} value={s}>{s} giây</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Người chơi tối đa</label>
          <input value="2 (bida carom 1–1)" readOnly className={`${inputCls} opacity-60`} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={guideline} onChange={(e) => setGuideline(e.target.checked)} /> Hiện đường ngắm dự đoán
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} /> Phòng riêng (không hiện trong danh sách)
      </label>
      {isPrivate && (
        <div>
          <label className={labelCls}>Mật khẩu (tuỳ chọn)</label>
          <input type="password" value={password} maxLength={32} onChange={(e) => setPassword(e.target.value)} placeholder="3–32 ký tự" className={inputCls} />
        </div>
      )}
      <p className="text-xs text-slate-500">Khán giả: chế độ chơi hiện tại chưa hỗ trợ người xem.</p>
      {searching && <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Bạn đang tìm trận — hãy huỷ tìm trận trước khi tạo phòng.</p>}
      <button type="button" disabled={busy || searching} onClick={() => void submit()} className="w-full rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold shadow-[0_4px_0_#7f1118] disabled:opacity-50">
        Tạo phòng
      </button>
    </div>
  );
}

/** Đấu thường: danh sách phòng công khai, tạo phòng, vào bằng mã / mật khẩu */
export default function CasualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"list" | "create">("list");
  const [code, setCode] = useState("");
  const [askPass, setAskPass] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const go = (c: string) => router.push(`/games/billiard/room/${c}`);
  const join = (c: string, hasPassword: boolean) => {
    if (hasPassword) {
      setAskPass(c);
      setPassword("");
    } else go(c);
  };
  const joinByCode = () => {
    const c = code.trim().toUpperCase();
    if (!CODE_RE.test(c)) return toast.error("Mã phòng gồm 6 ký tự chữ / số");
    go(c);
  };
  return (
    <>
      <Modal open={open} onClose={onClose} title="Đấu thường (Casual)" wide>
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setTab("list")} className={`flex-1 rounded-xl py-2 text-sm font-bold ${tab === "list" ? "bg-[#f4b942]/20 text-[#ffd166]" : "bg-white/5"}`}>
            <DoorOpen className="mr-1 inline h-4 w-4" /> Danh sách phòng
          </button>
          <button type="button" onClick={() => setTab("create")} className={`flex-1 rounded-xl py-2 text-sm font-bold ${tab === "create" ? "bg-[#f4b942]/20 text-[#ffd166]" : "bg-white/5"}`}>
            <Plus className="mr-1 inline h-4 w-4" /> Tạo phòng
          </button>
        </div>
        {tab === "list" ? (
          <>
            <div className="mb-3 flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && joinByCode()} placeholder="Nhập mã phòng (6 ký tự)" className={`${inputCls} font-mono tracking-widest`} />
              <button type="button" onClick={joinByCode} className="rounded-xl bg-[#f4b942]/15 px-4 font-bold text-[#ffd166]">
                Vào
              </button>
            </div>
            <RoomList onJoin={join} />
          </>
        ) : (
          <CreateRoomForm onCreated={go} />
        )}
      </Modal>
      <Modal open={!!askPass} onClose={() => setAskPass(null)} title="Phòng có mật khẩu">
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu phòng" className={inputCls} />
        <button
          type="button"
          disabled={!password}
          onClick={() => {
            if (!askPass) return;
            rememberRoomPassword(askPass, password);
            go(askPass);
          }}
          className="mt-3 w-full rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold disabled:opacity-50"
        >
          Vào phòng
        </button>
      </Modal>
    </>
  );
}
