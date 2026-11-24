/**
 * Đọc file ván đấu PSQ (định dạng của giải Gomocup / Piskvork):
 *   dòng 1: "Piskvorky 20x20, 11:11, 0" (kích thước bàn)
 *   các dòng sau: "x,y,thời_gian" (toạ độ đếm từ 1); các nước đầu có thời gian 0 là thế khai cuộc đặt sẵn.
 *   phần còn lại (tên engine, kết quả…) bị bỏ qua.
 */
export interface PsqGame {
  size: number;
  moves: [number, number][];
  /** Số nước khai cuộc đặt sẵn ở đầu (thời gian 0) */
  opening: number;
}

export function parsePsq(text: string): PsqGame | null {
  const lines = text.split(/\r?\n/);
  const head = /(\d+)x(\d+)/.exec(lines[0] ?? "");
  if (!head || head[1] !== head[2]) return null;
  const size = Number(head[1]);
  const moves: [number, number][] = [];
  let opening = 0;
  let inOpening = true;
  for (let i = 1; i < lines.length; i++) {
    const m = /^(\d+),(\d+),(\d+)$/.exec(lines[i].trim());
    if (!m) break;
    const x = Number(m[1]) - 1;
    const y = Number(m[2]) - 1;
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    moves.push([x, y]);
    if (inOpening && Number(m[3]) === 0) opening++;
    else inOpening = false;
  }
  return moves.length ? { size, moves, opening } : null;
}
