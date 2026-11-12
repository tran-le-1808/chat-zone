/**
 * Kiểu dáng dùng chung (phong cách Việt Nam: đỏ son – vàng kim, chất game).
 * Dùng chung cho mọi trang để giao diện đồng bộ.
 */
export const ui = {
  /** Thẻ nền tối có viền vàng kim mờ */
  card: "rounded-3xl border border-[#f4b942]/15 bg-[#11132a]/85 shadow-2xl backdrop-blur-md",
  /** Nút chính: đỏ son → cam, nổi như nút game */
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#c81d25] to-[#e8772e] px-5 py-3 font-bold text-white shadow-[0_4px_0_#7f1118] transition hover:brightness-110 active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
  /** Nút phụ: viền vàng kim */
  btnGold:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[#f4b942]/40 bg-[#f4b942]/10 px-5 py-3 font-bold text-[#ffd166] shadow-[0_4px_0_rgba(244,185,66,0.25)] transition hover:bg-[#f4b942]/20 active:translate-y-[3px] active:shadow-none",
  /** Nút trong suốt */
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white",
  /** Khung ô nhập (bọc icon + input) */
  field:
    "flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 transition focus-within:border-[#f4b942]/60 focus-within:shadow-[0_0_0_3px_rgba(244,185,66,0.12)]",
  /** Tiêu đề có chữ gradient vàng – cam */
  goldText:
    "bg-linear-to-r from-[#ffd166] via-[#f4b942] to-[#ff6b4a] bg-clip-text text-transparent",
} as const;
