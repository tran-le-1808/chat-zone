"use client";

/**
 * SẢNH BIDA LỖ — "Pool Arena", cùng thiết kế với sảnh Bida Carom (Carom Arena):
 * thanh trên + thẻ hồ sơ (ELO 8 bi / 9 bi) + lưới "Chế độ chơi" (bấm mở bảng tuỳ chọn)
 * + phòng công khai, trận gần đây, luật nhanh.
 */
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Crown,
  Dumbbell,
  Eye,
  Flame,
  Hash,
  History,
  Loader2,
  LogIn,
  Play,
  Swords,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { ui } from "@/components/ui/styles";
import { authUrlWithRedirect } from "@/lib/redirect";
import PlayerAvatar from "../../monopoly/_components/PlayerAvatar";
import { Empty, Modal, Section } from "../../billiard/_components/hub/ui";
import type { AiLevel, GameType } from "../_lib/rules/types";
import {
  POCKET_PRESETS,
  TABLE_SIZES,
  TABLE_SIZE_ORDER,
  type PocketPreset,
  type TableSize,
} from "../_lib/physics/config";
import type { PoolSetup } from "./PoolContext";
import { usePoolLobby, type PoolRating, type PoolType } from "./online/usePoolLobby";

type OfflineMode = "ai" | "match" | "practice";
const TYPE_NAME: Record<PoolType, string> = { eight: "8 bi", nine: "9 bi" };
const OFFLINE_TITLE: Record<OfflineMode, string> = {
  ai: "Đấu với máy",
  match: "2 người cùng máy",
  practice: "Tập luyện",
};

/* ------------------------------------------------------------------ */
/* Thành phần dùng chung                                               */
/* ------------------------------------------------------------------ */
function Chips<T extends string | number>({
  value,
  onChange,
  options,
  cols = 3,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string; hint?: string }[];
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-2xl border px-2 py-2.5 text-sm font-bold transition ${value === o.v ? "border-[#f4b942] bg-[#f4b942]/15 text-[#ffd166]" : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25"}`}
        >
          {o.label}
          {o.hint && <span className="block text-[10px] font-normal text-slate-400">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

const Field = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
    {children}
  </div>
);

/** Thẻ chế độ chơi — giống ModeCard của sảnh Carom */
function ModeCard({
  title,
  desc,
  icon,
  accent,
  stat,
  onClick,
  disabled,
  disabledText,
  cta,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
  stat?: string;
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
  cta: string;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#11132a]/90 p-4 shadow-xl transition duration-200 hover:-translate-y-1 hover:border-[#f4b942]/40 hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] ${disabled ? "opacity-60" : ""}`}
    >
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-xl ${accent}`} />
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${accent}`}>{icon}</div>
      <h3 className="text-lg font-black tracking-tight">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-400">{desc}</p>
      {stat && <p className="mt-2 text-xs font-bold text-emerald-300">{stat}</p>}
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] py-2.5 font-bold shadow-[0_4px_0_#7f1118] transition active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled && disabledText ? disabledText : cta}
      </button>
    </div>
  );
}

/** Thang ELO của một thể loại (giống LadderCard bên Carom) */
function RatingCard({ type, r }: { type: PoolType; r?: PoolRating[PoolType] }) {
  const elo = r?.elo ?? 1200;
  const games = r?.games ?? 0;
  const wins = r?.wins ?? 0;
  const rate = games ? Math.round((wins / games) * 100) : 0;
  // Tiến độ trong mốc 100 ELO hiện tại
  const progress = ((elo % 100) + 100) % 100;
  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-300">{TYPE_NAME[type]} · xếp hạng</p>
      <div className="mt-1 flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
          style={{ background: "radial-gradient(circle at 30% 25%, #ffd16666, #f4b94222)", boxShadow: "0 0 0 2px #f4b94288, 0 0 14px #f4b94255" }}
        >
          {type === "eight" ? "🎱" : "9️⃣"}
        </span>
        <span className="ml-auto text-2xl font-black text-[#ffd166]">{elo}</span>
      </div>
      <div className="mb-1 mt-2 flex justify-between text-[11px] text-slate-400">
        <span>
          {wins}T – {games - wins}B {games ? `(${rate}%)` : ""}
        </span>
        <span>Tới {Math.floor(elo / 100) * 100 + 100}: {100 - progress}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full bg-linear-to-r from-[#f4b942] to-[#ff6b4a]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng tuỳ chọn chơi offline (máy / 2 người / tập luyện)              */
/* ------------------------------------------------------------------ */
function OfflineSetupModal({
  mode,
  myName,
  onClose,
  onStart,
}: {
  mode: OfflineMode | null;
  myName: string;
  onClose: () => void;
  onStart: (s: PoolSetup) => void;
}) {
  const [type, setType] = useState<GameType>("eight");
  const [level, setLevel] = useState<AiLevel>("medium");
  const [raceTo, setRaceTo] = useState(3);
  const [breakRule, setBreakRule] = useState<"alternate" | "winner">("alternate");
  const [autoCall, setAutoCall] = useState(true);
  const [pocketPreset, setPocketPreset] = useState<PocketPreset>("wpa");
  const [tableSize, setTableSize] = useState<TableSize>("9ft");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("Người chơi 2");
  if (!mode) return null;

  const start = () => {
    const LEVEL_NAME: Record<AiLevel, string> = { easy: "Máy (Dễ)", medium: "Máy (Vừa)", hard: "Máy (Khó)" };
    onStart({
      mode: mode === "practice" ? "practice" : "match",
      config: {
        type,
        raceTo: mode === "practice" ? 1 : raceTo,
        breakRule,
        autoCall,
        pocketPreset,
        tableSize,
        allowFullGuide: true,
        seed: (Date.now() >>> 0) % 1e9,
        players: [
          { name: (p1.trim() || myName || "Người chơi 1").slice(0, 20), ai: null },
          mode === "ai" ? { name: LEVEL_NAME[level], ai: level } : { name: (p2 || "Người chơi 2").slice(0, 20), ai: null },
        ],
      },
    });
  };
  const input = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#f4b942]/60";

  return (
    <Modal open onClose={onClose} title={OFFLINE_TITLE[mode]} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field title="Thể loại">
          <Chips
            value={type}
            onChange={setType}
            cols={2}
            options={[
              { v: "eight", label: "8 bi", hint: "Trơn / sọc, gọi bi" },
              { v: "nine", label: "9 bi", hint: "Bi nhỏ nhất trước" },
            ]}
          />
        </Field>
        {mode === "ai" ? (
          <Field title="Độ khó của máy">
            <Chips value={level} onChange={setLevel} options={[{ v: "easy", label: "Dễ" }, { v: "medium", label: "Vừa" }, { v: "hard", label: "Khó" }]} />
          </Field>
        ) : (
          <Field title={mode === "match" ? "Tên người chơi" : "Tên của bạn"}>
            <div className={`grid gap-2 ${mode === "match" ? "grid-cols-2" : ""}`}>
              <input value={p1} onChange={(e) => setP1(e.target.value)} placeholder={myName || "Người chơi 1"} maxLength={20} aria-label="Tên người chơi 1" className={input} />
              {mode === "match" && <input value={p2} onChange={(e) => setP2(e.target.value)} maxLength={20} aria-label="Tên người chơi 2" className={input} />}
            </div>
          </Field>
        )}
        <Field title="Cỡ bàn">
          <Chips
            value={tableSize}
            onChange={setTableSize}
            options={TABLE_SIZE_ORDER.map((k) => ({
              v: k,
              label: TABLE_SIZES[k].label,
              hint: `${Math.round(TABLE_SIZES[k].length * 100)} × ${Math.round(TABLE_SIZES[k].width * 100)} cm`,
            }))}
          />
        </Field>
        <Field title="Độ khó lỗ">
          <Chips
            value={pocketPreset}
            onChange={setPocketPreset}
            options={(Object.keys(POCKET_PRESETS) as PocketPreset[]).map((k) => ({
              v: k,
              label: POCKET_PRESETS[k].label.replace(" (giải trí)", "").replace(" / lỗ chặt", ""),
              hint: `${(POCKET_PRESETS[k].corner * 100).toFixed(1)} / ${(POCKET_PRESETS[k].side * 100).toFixed(1)} cm`,
            }))}
          />
        </Field>
        {mode !== "practice" && (
          <>
            <Field title="Thắng chung cuộc">
              <Chips value={raceTo} onChange={setRaceTo} cols={4} options={[1, 3, 5, 7].map((n) => ({ v: n, label: `Chạm ${n}` }))} />
            </Field>
            <Field title="Luật phá">
              <Chips
                value={breakRule}
                onChange={setBreakRule}
                cols={2}
                options={[
                  { v: "alternate", label: "Luân phiên" },
                  { v: "winner", label: "Thắng ván phá" },
                ]}
              />
            </Field>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {TABLE_SIZES[tableSize].note} · Lỗ: {POCKET_PRESETS[pocketPreset].note}
      </p>
      {mode !== "practice" && type === "eight" && (
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm">
          <span>
            <b>Tự gọi cú hiển nhiên</b>
            <span className="block text-xs text-slate-400">Gọi bi & lỗ theo đường ngắm, vẫn đổi tay được</span>
          </span>
          <input type="checkbox" checked={autoCall} onChange={(e) => setAutoCall(e.target.checked)} className="h-5 w-5 accent-[#f4b942]" />
        </label>
      )}
      <button
        type="button"
        onClick={start}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 py-3 font-bold shadow-[0_4px_0_#065f46] transition active:translate-y-[3px] active:shadow-none"
      >
        <Play className="h-4 w-4 fill-current" /> Vào bàn
      </button>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Trang sảnh                                                          */
/* ------------------------------------------------------------------ */
export default function PoolSetupScreen({
  myName,
  myUserId,
  onStart,
}: {
  myName: string;
  myUserId: string | null;
  onStart: (s: PoolSetup) => void;
}) {
  const online = !!myUserId;
  const lobby = usePoolLobby(online);
  const { rooms, me, queue, waited } = lobby;
  const [offline, setOffline] = useState<OfflineMode | null>(null);
  const [rankedOpen, setRankedOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [code, setCode] = useState("");
  const rating = me?.rating;
  const history = me?.history ?? [];
  const games = (rating?.eight.games ?? 0) + (rating?.nine.games ?? 0);
  const wins = (rating?.eight.wins ?? 0) + (rating?.nine.wins ?? 0);
  const loginHref = authUrlWithRedirect("/login", "/games/pool");
  const needLogin = online ? undefined : "Đăng nhập để chơi online";

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#14532d_0%,#0b1a14_45%,#070b10_100%)] text-white">
      {/* THANH TRÊN */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1a14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6">
          <Link href="/games" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10" aria-label="Khu vực trò chơi">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-600 to-emerald-800 shadow-[0_3px_0_#064e3b]">
              <Target className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-black tracking-tight">
              Pool <span className={ui.goldText}>Arena</span>
            </span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            {online ? (
              <span className="flex items-center gap-2 rounded-xl px-2 py-1">
                <PlayerAvatar name={myName || "?"} size={34} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-32 truncate text-sm font-bold">{myName}</span>
                  <span className="block text-[11px] text-slate-400">
                    {games} trận · {wins} thắng
                  </span>
                </span>
                {(["eight", "nine"] as const).map((t) => (
                  <span key={t} className="hidden text-[11px] font-bold leading-tight text-[#ffd166] sm:inline" title={`${TYPE_NAME[t]}: ELO`}>
                    <span className="block text-[9px] font-semibold uppercase text-slate-400">{TYPE_NAME[t]}</span>
                    {rating?.[t].elo ?? 1200}
                  </span>
                ))}
              </span>
            ) : (
              <Link href={loginHref} className={`${ui.btnPrimary} px-3! py-1.5! text-sm`}>
                <LogIn className="h-4 w-4" /> Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 pb-28 sm:space-y-5 sm:px-6 sm:py-6">
        {/* HỒ SƠ */}
        <section className="relative overflow-hidden rounded-3xl border border-[#f4b942]/25 bg-linear-to-br from-[#123b2a] via-[#0f2a20] to-[#111827] p-4 shadow-2xl sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <PlayerAvatar name={myName || "Khách"} size={72} />
              <div className="min-w-0">
                <p className="truncate text-xl font-black">{myName || "Khách"}</p>
                <p className="text-sm text-slate-300">Bida lỗ 8 bi & 9 bi · luật WPA</p>
                <p className="text-xs text-slate-400">
                  {online ? `${games} trận xếp hạng · ${wins} thắng · ${games - wins} thua${games ? ` · ${Math.round((wins / games) * 100)}%` : ""}` : "Chơi với máy / 2 người không cần đăng nhập"}
                </p>
              </div>
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <RatingCard type="eight" r={rating?.eight} />
              <RatingCard type="nine" r={rating?.nine} />
            </div>
          </div>
        </section>

        {/* CHẾ ĐỘ CHƠI */}
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-300">
            <Swords className="h-4 w-4" /> Chế độ chơi
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ModeCard
              title="RANKED MATCH"
              desc="Ghép ngay với người đang chờ (không cần cùng trình độ), tính ELO. Chạm 3, lỗ WPA, bàn 9 feet."
              icon={<Crown className="h-6 w-6" />}
              accent="bg-[#c8941d]"
              stat={online ? `ELO 8 bi ${rating?.eight.elo ?? 1200} · 9 bi ${rating?.nine.elo ?? 1200}` : undefined}
              onClick={() => setRankedOpen(true)}
              disabled={!online || !!queue}
              disabledText={needLogin ?? "Đang tìm trận…"}
              cta="Đấu xếp hạng"
            />
            <ModeCard
              title="PHÒNG RIÊNG"
              desc="Tạo phòng, chỉnh luật & cỡ bàn, mời bạn bè bằng mã phòng. Không tính ELO."
              icon={<Users className="h-6 w-6" />}
              accent="bg-sky-600"
              stat={online ? `${rooms.length} phòng đang mở` : undefined}
              onClick={() => setRoomOpen(true)}
              disabled={!online}
              disabledText={needLogin}
              cta="Vào phòng"
            />
            <ModeCard
              title="ĐẤU VỚI MÁY"
              desc="Máy 3 cấp độ (Dễ / Vừa / Khó), tự chọn thể loại, cỡ bàn và độ khó lỗ."
              icon={<Bot className="h-6 w-6" />}
              accent="bg-emerald-600"
              onClick={() => setOffline("ai")}
              cta="Chơi với máy"
            />
            <ModeCard
              title="2 NGƯỜI"
              desc="Hai người thay phiên trên cùng một máy, trọng tài tự động như online."
              icon={<Swords className="h-6 w-6" />}
              accent="bg-[#b4532a]"
              onClick={() => setOffline("match")}
              cta="Chơi 2 người"
            />
            <ModeCard
              title="TẬP LUYỆN"
              desc="Bàn tự do: sắp bi tuỳ ý, xếp lại 8 / 9 bi, hoàn tác cú vừa đánh."
              icon={<Dumbbell className="h-6 w-6" />}
              accent="bg-teal-600"
              onClick={() => setOffline("practice")}
              cta="Vào luyện tập"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Section
              title={`Phòng công khai${online ? ` (${rooms.length})` : ""}`}
              icon={<Flame className="h-5 w-5 text-[#ffd166]" />}
              action={
                online ? (
                  <button type="button" onClick={() => setRoomOpen(true)} className="text-xs font-bold text-[#ffd166]">
                    Tạo phòng
                  </button>
                ) : undefined
              }
            >
              {!online ? (
                <Empty text="Đăng nhập để xem và vào phòng online">
                  <Link href={loginHref} className="text-xs font-bold text-[#ffd166]">
                    Đăng nhập
                  </Link>
                </Empty>
              ) : !rooms.length ? (
                <Empty text="Chưa có phòng nào — hãy tạo phòng hoặc đấu xếp hạng" />
              ) : (
                <ul className="space-y-1.5">
                  {rooms.map((r) => (
                    <li key={r.code} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2 hover:bg-white/[0.08]">
                      <span className="font-mono text-xs tracking-widest text-[#ffd166]">{r.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{r.players.map((p) => p.name).join(" vs ")}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {TYPE_NAME[r.settings.type]} · chạm {r.settings.raceTo} · bàn {TABLE_SIZES[r.settings.tableSize ?? "9ft"].label} · {POCKET_PRESETS[r.settings.pocketPreset]?.label}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Users className="h-3.5 w-3.5" /> {r.players.length}/2
                      </span>
                      <button type="button" onClick={() => lobby.join(r.code)} className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-bold hover:bg-white/20">
                        {r.status === "lobby" ? (
                          "Vào chơi"
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Xem
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Trận gần đây" icon={<History className="h-5 w-5 text-[#ffd166]" />}>
              {!history.length ? (
                <Empty text={online ? "Chưa có trận online nào kết thúc" : "Đăng nhập để lưu lịch sử trận"} />
              ) : (
                <ul className="space-y-1.5">
                  {history.slice(0, 8).map((m) => {
                    const mine = m.players.find((p) => p.userId === myUserId);
                    const won = mine && m.winner === mine.seat;
                    const opp = m.players.find((p) => p.userId !== myUserId);
                    return (
                      <li key={m._id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                        <span className="rounded-md bg-white/10 px-1.5 text-[10px] font-bold">{m.ranked ? "Xếp hạng" : "Phòng"}</span>
                        <span className={`w-10 font-black ${won ? "text-emerald-300" : "text-rose-300"}`}>{won ? "Thắng" : "Thua"}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {m.type === "eight" ? "8 bi" : "9 bi"} vs {opp?.name ?? "?"}
                        </span>
                        <span className="font-black">{m.score.join(" – ")}</span>
                        {m.ranked && mine && m.eloChange && (
                          <span className="flex items-center gap-0.5 text-xs font-bold text-[#ffd166]">
                            <Trophy className="h-3 w-3" />
                            {m.eloChange[mine.seat] >= 0 ? "+" : ""}
                            {m.eloChange[mine.seat]}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Luật nhanh" icon={<BookOpen className="h-5 w-5 text-[#ffd166]" />}>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl bg-black/25 p-3">
                <p className="mb-1 font-extrabold text-white">🎱 8 bi</p>
                <p>Chia nhóm trơn (1–7) / sọc (9–15). Đánh hết nhóm mình rồi gọi lỗ cho bi 8. Đưa bi 8 vào lỗ khi chưa sạch nhóm, sai lỗ đã gọi hoặc kèm lỗi là thua ván (trừ cú phá).</p>
              </div>
              <div className="rounded-2xl bg-black/25 p-3">
                <p className="mb-1 font-extrabold text-white">9️⃣ 9 bi</p>
                <p>Luôn chạm bi số nhỏ nhất trước. Ai đưa bi 9 vào lỗ hợp lệ thì thắng ván. 3 lỗi liên tiếp là thua ván.</p>
              </div>
              <div className="rounded-2xl bg-black/25 p-3">
                <p className="mb-1 font-extrabold text-white">📏 Cỡ bàn</p>
                <ul className="space-y-0.5 text-xs text-slate-400">
                  {TABLE_SIZE_ORDER.map((k) => (
                    <li key={k}>
                      <b className="text-slate-200">{TABLE_SIZES[k].label}</b> — {TABLE_SIZES[k].note.replace("Mặt chơi ", "")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>
        </div>
      </main>

      {/* Đang tìm trận (giống lớp tìm trận của sảnh Carom) */}
      {queue && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#f4b942]/40 bg-[#11132a]/95 px-4 py-3 shadow-2xl backdrop-blur">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#ffd166]" />
            <span className="min-w-0 flex-1 text-sm">
              <b className="block">Đang tìm trận {TYPE_NAME[queue.type]}…</b>
              <span className="text-xs text-slate-400">
                ELO {queue.elo} · ghép với người đang chờ · {Math.round(waited)}s
              </span>
            </span>
            <button type="button" onClick={() => void lobby.cancel()} className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">
              <X className="h-4 w-4" /> Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Đấu xếp hạng */}
      <Modal open={rankedOpen} onClose={() => setRankedOpen(false)} title="Đấu xếp hạng">
        <p className="mb-3 text-sm text-slate-400">8 bi và 9 bi có ELO riêng. Trận xếp hạng: chạm 3, lỗ WPA, bàn 9 feet, có đồng hồ cú đánh.</p>
        <div className="grid gap-2">
          {(["eight", "nine"] as const).map((t) => (
            <div key={t}>
              <RatingCard type={t} r={rating?.[t]} />
              <button
                type="button"
                disabled={!!queue}
                onClick={() => void lobby.quick(t).then((ok) => ok && setRankedOpen(false))}
                className="mt-2 w-full rounded-xl bg-linear-to-r from-[#c8941d] to-[#e8772e] py-3 font-bold shadow-[0_4px_0_#7a5410] transition active:translate-y-[3px] active:shadow-none disabled:opacity-50"
              >
                Tìm trận xếp hạng {TYPE_NAME[t]}
              </button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Phòng riêng */}
      <Modal open={roomOpen} onClose={() => setRoomOpen(false)} title="Phòng riêng">
        <p className="mb-3 text-sm text-slate-400">Tạo phòng rồi chỉnh thể loại, cỡ bàn, độ khó lỗ trong phòng chờ — hoặc vào phòng của bạn bè bằng mã.</p>
        <button
          type="button"
          disabled={lobby.busy}
          onClick={() => void lobby.create()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-sky-500 to-sky-600 py-3 font-bold shadow-[0_4px_0_#075985] transition active:translate-y-[3px] active:shadow-none disabled:opacity-50"
        >
          {lobby.busy && <Loader2 className="h-4 w-4 animate-spin" />} Tạo phòng mới
        </button>
        <form
          className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            lobby.join(code);
          }}
        >
          <Hash className="h-4 w-4 shrink-0 text-[#f4b942]" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Nhập mã phòng"
            aria-label="Mã phòng"
            className="w-full min-w-0 bg-transparent py-1 font-mono tracking-widest text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500"
          />
          <button type="submit" className="shrink-0 rounded-lg bg-[#f4b942] px-3 py-1 text-sm font-bold text-[#1a1206]">
            Vào
          </button>
        </form>
      </Modal>

      <OfflineSetupModal key={offline ?? "none"} mode={offline} myName={myName} onClose={() => setOffline(null)} onStart={onStart} />
    </div>
  );
}
