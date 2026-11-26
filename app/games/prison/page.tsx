"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Hash, KeyRound, Loader2, Play, Plus, RefreshCw, RotateCcw, User, Users } from "lucide-react";
import { toast } from "sonner";
import MainLayout from "@/components/layout/MainLayout";
import { ui } from "@/components/ui/styles";
import { useAppSelector } from "@/redux/hooks";
import type { RoomView } from "./_lib/engine/protocol";
import type { Difficulty, Role } from "./_lib/engine/types";
import { acquirePrisonSocket, prisonEmit, releasePrisonSocket, waitConnected } from "./_lib/net/prisonSocket";
import { LocalSession } from "./_lib/session/LocalSession";
import { deleteSave, listSaves, readSave, type SaveMeta, type SlotId } from "./_lib/session/save";
import PrisonGame from "./_components/PrisonGame";
import { DifficultyPicker, RolePicker } from "./_components/RoleDifficulty";

/** Prison Break – Last Chance: chơi đơn (engine chạy trong trình duyệt) hoặc co-op 1–4 người */
export default function PrisonPage() {
  const name = useAppSelector((s) => s.auth.user?.name ?? "Tù nhân");
  const [session, setSession] = useState<LocalSession | null>(null);

  useEffect(() => () => session?.dispose(), [session]);

  if (session)
    return (
      <PrisonGame
        session={session}
        title="Chơi đơn"
        onExit={() => {
          session.dispose();
          setSession(null);
        }}
      />
    );
  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-5 text-white sm:px-6 sm:py-8">
        <div>
          <Link href="/games" className={`${ui.btnGhost} -ml-2 mb-2 px-3! py-1.5! text-sm`}>
            <ArrowLeft className="h-4 w-4" /> Khu trò chơi
          </Link>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[#334155] to-[#0f172a] text-2xl shadow-[0_4px_0_#020617]">⛓️</span>
            <span className={ui.goldText}>Prison Break – Last Chance</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Quan sát lịch tuần tra, lục soát nguyên liệu, chế tạo dụng cụ và cùng đồng đội vượt ngục. Co-op chỉ thắng khi <b className="text-[#ffd166]">tất cả</b> cùng thoát.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <SinglePlayerCard name={name} onStart={setSession} />
          <CoopCard />
        </div>
      </div>
    </MainLayout>
  );
}

function SinglePlayerCard({ name, onStart }: { name: string; onStart: (s: LocalSession) => void }) {
  const [role, setRole] = useState<Role>("SCOUT");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [dayLimit, setDayLimit] = useState<number | null>(30);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const refresh = useCallback(() => {
    void listSaves().then(setSaves);
  }, []);
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);
  const load = async (slot: SlotId) => {
    const s = await readSave(slot);
    if (!s) return toast.error("Không đọc được bản lưu");
    onStart(new LocalSession({ world: s.world, name, role, difficulty }));
  };
  const slotName = (s: SlotId) => (s === "auto" ? "Tự động" : `Ô ${s.slice(-1)}`);
  return (
    <section className={`${ui.card} space-y-4 p-5`}>
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <User className="h-5 w-5 text-[#ffd166]" /> Chơi đơn
      </h2>
      <p className="text-xs text-slate-400">Không cần máy chủ. Tự lưu lúc nửa đêm trong game và khi thoát; 3 ô lưu thủ công (bấm tạm dừng để lưu).</p>
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">Vai trò</p>
        <RolePicker value={role} onChange={setRole} />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">Độ khó</p>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">Thời hạn</p>
        <div className="grid grid-cols-3 gap-2">
          {([15, 30, null] as const).map((d) => (
            <button key={String(d)} type="button" onClick={() => setDayLimit(d)} className={`rounded-2xl border p-2 text-sm font-bold ${dayLimit === d ? "border-[#f4b942]/70 bg-[#f4b942]/10" : "border-white/10 bg-white/[0.03]"}`}>
              {d ? `${d} ngày` : "Không giới hạn"}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className={`${ui.btnPrimary} w-full`} onClick={() => onStart(new LocalSession({ name, role, difficulty, dayLimit }))}>
        <Play className="h-4 w-4 fill-current" /> Ván mới
      </button>
      {saves.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-slate-400">Tiếp tục</p>
          {saves.map((s) => (
            <div key={s.slot} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-sm">
              <RotateCcw className="h-4 w-4 shrink-0 text-[#ffd166]" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {slotName(s.slot)} · Ngày {s.day}, {String(s.hour).padStart(2, "0")}h
                </p>
                <p className="truncate text-xs text-slate-400">
                  {s.name} · {s.role} · {s.difficulty} · {new Date(s.savedAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <button type="button" className={`${ui.btnGold} px-3! py-2! text-sm`} onClick={() => void load(s.slot)}>
                Tải
              </button>
              <button type="button" aria-label="Xoá bản lưu" className="rounded-lg p-2 text-slate-500 hover:text-red-300" onClick={() => void deleteSave(s.slot).then(refresh)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CoopCard() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [mine, setMine] = useState<RoomView | null>(null);
  const [code, setCode] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [allowLateJoin, setAllowLateJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const s = acquirePrisonSocket();
    const ok = await waitConnected(s);
    setOnline(ok);
    if (ok) {
      const [list, my] = await Promise.all([prisonEmit<RoomView[]>(s, "room:list"), prisonEmit<RoomView | null>(s, "room:mine")]);
      if (list.ok) setRooms(list.data ?? []);
      if (my.ok) setMine(my.data ?? null);
    }
    releasePrisonSocket();
  }, []);

  useEffect(() => {
    acquirePrisonSocket();
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), 8000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      releasePrisonSocket();
    };
  }, [refresh]);

  const create = async () => {
    setBusy(true);
    const s = acquirePrisonSocket();
    await waitConnected(s);
    const r = await prisonEmit<{ room: RoomView }>(s, "room:create", { settings: { difficulty, privateRoom, allowLateJoin } });
    releasePrisonSocket();
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    router.push(`/games/prison/room/${r.data!.room.roomCode}`);
  };

  return (
    <section className={`${ui.card} space-y-4 p-5`}>
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Users className="h-5 w-5 text-[#ffd166]" /> Co-op 1–4 người
        {online === false && <span className="ml-auto text-xs font-semibold text-red-300">Không kết nối được máy chủ</span>}
      </h2>
      {mine && (
        <Link href={`/games/prison/room/${mine.roomCode}`} className={`${ui.btnGold} w-full`}>
          Quay lại phòng {mine.roomCode} ({mine.status === "WAITING" ? "đang chờ" : "đang chơi"})
        </Link>
      )}
      <div className="space-y-3 rounded-2xl bg-white/[0.03] p-3">
        <p className="text-xs font-bold uppercase text-slate-400">Tạo phòng</p>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={privateRoom} onChange={(e) => setPrivateRoom(e.target.checked)} /> Phòng riêng tư
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowLateJoin} onChange={(e) => setAllowLateJoin(e.target.checked)} /> Cho vào giữa chừng
          </label>
        </div>
        <button type="button" disabled={busy} className={`${ui.btnPrimary} w-full`} onClick={() => void create()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tạo phòng
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().toUpperCase();
          if (c.length >= 4) router.push(`/games/prison/room/${c}`);
        }}
      >
        <div className={`${ui.field} flex-1 py-2.5`}>
          <KeyRound className="h-4 w-4 text-[#f4b942]/80" />
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="Nhập mã phòng" aria-label="Mã phòng" className="w-full min-w-0 bg-transparent uppercase tracking-widest outline-none placeholder:normal-case placeholder:tracking-normal" />
        </div>
        <button type="submit" className={ui.btnGold}>
          Vào
        </button>
      </form>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase text-slate-400">Phòng công khai</p>
          <button type="button" onClick={() => void refresh()} className="rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Làm mới">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Chưa có phòng nào — hãy tạo phòng và mời bạn bè!</p>
        ) : (
          <div className="space-y-2">
            {rooms.map((r) => (
              <Link key={r.roomCode} href={`/games/prison/room/${r.roomCode}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-[#f4b942]/40">
                <Hash className="h-4 w-4 text-[#ffd166]" />
                <span className="font-mono font-bold tracking-widest">{r.roomCode}</span>
                <span className="text-xs text-slate-400">{r.members.find((m) => m.isHost)?.name}</span>
                <span className="ml-auto text-xs">
                  {r.members.length}/{r.settings.maxPlayers} · {r.settings.difficulty}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
