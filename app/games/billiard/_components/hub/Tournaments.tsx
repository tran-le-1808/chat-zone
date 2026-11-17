"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Lock, Plus, Search, Trophy } from "lucide-react";
import { useLobby } from "../../_context/BilliardLobbyContext";
import ThumbnailPicker from "./ThumbnailPicker";
import { bidaEmit } from "../../_lib/lobbyApi";
import { TABLE_MODE_NAME, TOURNAMENT_STATUS_LABEL, type Page, type TournamentView } from "../../_lib/lobbyTypes";
import type { CaromMode } from "../../_lib/physics";
import { Empty, ErrorBox, fmtDate, inputCls, labelCls, Loading, Modal, Pagination } from "./ui";

const toLocalInput = (t: number) => {
  const d = new Date(t - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function CreateTournamentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { config, mm } = useLobby();
  const searching = mm.state !== "idle";
  const [form, setForm] = useState(() => ({
    name: "",
    description: "",
    thumbnail: "",
    maxParticipants: 8,
    mode: "free" as CaromMode,
    target: 10,
    startAt: toLocalInput(Date.now() + 30 * 60_000),
    registrationDeadline: toLocalInput(Date.now() + 20 * 60_000),
    seeding: "random" as "random" | "rating",
    matchDurationMinutes: 20,
    visibility: "PUBLIC" as "PUBLIC" | "PRIVATE",
    password: "",
    joinAsPlayer: true,
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Ô nhập số điểm: giữ chữ đang gõ, chỉ chuẩn hoá 5–30 khi rời ô (gõ "12" không bị nhảy giữa chừng) */
  const [targetText, setTargetText] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const tMin = config?.tournament.targetMin ?? 5;
  const tMax = config?.tournament.targetMax ?? 30;
  const setTarget = (v: number) => set("target", Math.max(tMin, Math.min(tMax, Math.round(Number.isFinite(v) ? v : tMin))));
  const submit = async () => {
    if (form.name.trim().length < 3) return toast.error("Tên giải tối thiểu 3 ký tự");
    if (form.target < tMin || form.target > tMax) return toast.error(`Số điểm từ ${tMin} đến ${tMax}`);
    setBusy(true);
    const res = await bidaEmit<TournamentView>("bida:tournament:create", {
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.thumbnail.trim() ? { thumbnail: form.thumbnail.trim() } : {}),
      maxParticipants: form.maxParticipants,
      mode: form.mode,
      target: form.target,
      startAt: new Date(form.startAt).getTime(),
      registrationDeadline: new Date(form.registrationDeadline).getTime(),
      format: "SINGLE_ELIMINATION",
      seeding: form.seeding,
      matchDurationMinutes: form.matchDurationMinutes,
      visibility: form.visibility,
      ...(form.visibility === "PRIVATE" ? { password: form.password } : {}),
      joinAsPlayer: form.joinAsPlayer,
    });
    setBusy(false);
    if (!res.ok || !res.data) return toast.error(res.error ?? "Không tạo được giải");
    toast.success("Đã tạo giải đấu");
    onClose();
    router.push(`/games/billiard/tournament/${res.data.tournamentId}`);
  };
  return (
    <Modal open={open} onClose={onClose} title="Tạo giải đấu" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Tên giải đấu</label>
          <input value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="Cúp Carom mùa xuân" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Mô tả</label>
          <textarea value={form.description} maxLength={500} onChange={(e) => set("description", e.target.value)} className={`${inputCls} min-h-20`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Ảnh giải (tuỳ chọn)</label>
          <ThumbnailPicker value={form.thumbnail} onChange={(url) => set("thumbnail", url)} onBusy={setUploading} />
        </div>
        <div>
          <label className={labelCls}>Số người tham gia</label>
          <select value={form.maxParticipants} onChange={(e) => set("maxParticipants", Number(e.target.value))} className={inputCls}>
            {(config?.tournament.sizes ?? [4, 8]).map((n) => (
              <option key={n} value={n}>{n} người</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Loại bida</label>
          <div className="grid grid-cols-2 gap-2">
            {(["free", "three"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("mode", m)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold ${form.mode === m ? "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.04]"}`}
              >
                {TABLE_MODE_NAME[m]}
                <span className="block text-[11px] font-normal text-slate-400">
                  {m === "free" ? "Bi cái chạm được 2 bi là ghi điểm" : "Chạm ít nhất 3 băng trước bi thứ hai"}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>
            Số điểm để thắng ({tMin}–{tMax})
          </label>
          <div className="flex items-center gap-3">
            <input type="range" min={tMin} max={tMax} step={1} value={form.target} onChange={(e) => setTarget(Number(e.target.value))} className="flex-1 accent-[#f4b942]" aria-label="Số điểm" />
            <input
              type="number"
              inputMode="numeric"
              min={tMin}
              max={tMax}
              step={1}
              value={targetText ?? String(form.target)}
              onChange={(e) => setTargetText(e.target.value)}
              onBlur={() => {
                if (targetText !== null) setTarget(Number(targetText));
                setTargetText(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className={`${inputCls} w-20 text-center font-bold`}
              aria-label="Số điểm (nhập)"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Luật trận: {TABLE_MODE_NAME[form.mode]} · chạm {form.target} điểm</p>
        </div>
        <div>
          <label className={labelCls}>Hạn đăng ký</label>
          <input type="datetime-local" value={form.registrationDeadline} onChange={(e) => set("registrationDeadline", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Giờ bắt đầu</label>
          <input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Thể thức</label>
          <select value="SINGLE_ELIMINATION" className={inputCls} disabled>
            <option value="SINGLE_ELIMINATION">Loại trực tiếp (Single Elimination)</option>
          </select>
          <p className="mt-1 text-[11px] text-slate-500">Double Elimination sẽ có sau.</p>
        </div>
        <div>
          <label className={labelCls}>Xếp cặp</label>
          <select value={form.seeding} onChange={(e) => set("seeding", e.target.value as "random" | "rating")} className={inputCls}>
            <option value="random">Ngẫu nhiên</option>
            <option value="rating">Theo Rating</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Thời gian dự kiến mỗi trận (phút)</label>
          <input type="number" min={5} max={120} value={form.matchDurationMinutes} onChange={(e) => set("matchDurationMinutes", Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Hiển thị</label>
          <select value={form.visibility} onChange={(e) => set("visibility", e.target.value as "PUBLIC" | "PRIVATE")} className={inputCls}>
            <option value="PUBLIC">Công khai</option>
            <option value="PRIVATE">Riêng tư (có mật khẩu)</option>
          </select>
        </div>
        {form.visibility === "PRIVATE" && (
          <div>
            <label className={labelCls}>Mật khẩu</label>
            <input type="password" value={form.password} maxLength={32} onChange={(e) => set("password", e.target.value)} className={inputCls} />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.joinAsPlayer} onChange={(e) => set("joinAsPlayer", e.target.checked)} /> Tôi cũng tham gia thi đấu
        </label>
        <p className="text-xs text-slate-500 sm:col-span-2">
          Check-in mở {config?.tournament.checkInMinutes ?? 10} phút trước giờ bắt đầu; ai không check-in sẽ bị loại. Phí tham gia / giải thưởng: game chưa có hệ thống tiền tệ nên không áp dụng.
        </p>
      </div>
      {searching && <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Bạn đang tìm trận — hãy huỷ tìm trận trước khi tạo giải đấu.</p>}
      <button type="button" disabled={busy || uploading || searching} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-3 font-bold shadow-[0_4px_0_#7f1118] disabled:opacity-50">
        Tạo giải đấu
      </button>
    </Modal>
  );
}

const FILTERS = [
  ["upcoming", "Sắp diễn ra"],
  ["live", "Đang thi đấu"],
  ["finished", "Đã kết thúc"],
  ["all", "Tất cả"],
] as const;

export default function TournamentsPage() {
  const params = useSearchParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("upcoming");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<TournamentView> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [create, setCreate] = useState(params.get("create") === "1");
  const { mm } = useLobby();
  const searching = mm.state !== "idle";

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const res = await bidaEmit<Page<TournamentView>>("bida:tournament:list", { page, pageSize: 12, filter, ...(debounced ? { search: debounced } : {}) });
    if (res.ok && res.data) {
      setData(res.data);
      setError(null);
    } else setError(res.error ?? "Không tải được danh sách giải");
  }, [page, filter, debounced]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Trophy className="h-7 w-7 text-[#ffd166]" /> Giải đấu
        </h1>
        <button type="button" disabled={searching} title={searching ? "Đang tìm trận — huỷ tìm trận để tạo giải" : undefined} onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-4 py-2.5 font-bold shadow-[0_4px_0_#7f1118] disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="h-5 w-5" /> {searching ? "Đang tìm trận…" : "Tạo giải đấu"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setFilter(k); setPage(1); }} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${filter === k ? "bg-[#f4b942]/20 text-[#ffd166]" : "bg-white/5 text-slate-300"}`}>
            {l}
          </button>
        ))}
        <label className="ml-auto flex min-w-48 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm giải đấu…" className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
      </div>
      {data === null && !error ? <Loading /> : error ? <ErrorBox text={error} onRetry={() => void load()} /> : !data?.items.length ? (
        <Empty text="Không có giải đấu nào">
          <button type="button" disabled={searching} onClick={() => setCreate(true)} className="text-xs font-bold text-[#ffd166] disabled:opacity-50">Tạo giải đấu đầu tiên</button>
        </Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((t) => (
              <Link key={t.tournamentId} href={`/games/billiard/tournament/${t.tournamentId}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-[#11132a]/90 shadow-xl transition hover:-translate-y-1 hover:border-[#f4b942]/40">
                <div className="relative h-28 bg-linear-to-br from-emerald-800 to-[#0b1a14]">
                  {t.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumbnail} alt="" className="h-full w-full object-cover opacity-80" />
                  )}
                  <span className="absolute left-3 top-3 rounded-lg bg-black/50 px-2 py-0.5 text-[11px] font-bold">{TOURNAMENT_STATUS_LABEL[t.status]}</span>
                  {t.hasPassword && <Lock className="absolute right-3 top-3 h-4 w-4 text-[#ffd166]" />}
                </div>
                <div className="p-4">
                  <p className="truncate text-lg font-black">{t.name}</p>
                  <p className="text-xs text-slate-400">Tổ chức: {t.organizerName}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-bold text-[#ffd166]">
                      {t.participants.length}/{t.maxParticipants} người
                    </span>
                    <span className="text-xs text-slate-400">{t.ruleName}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Bắt đầu: {fmtDate(t.startAt)}</p>
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
      <CreateTournamentModal open={create} onClose={() => setCreate(false)} />
    </div>
  );
}
