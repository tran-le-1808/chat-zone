/** Cờ vua: perft (thế ban đầu + Kiwipete + thế 3 có bắt tốt qua đường), các kết thúc ván, SAN */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMove, fromFEN, legalMoves, makeMove, newGame, sq, type ChessState, type Pos, QUEEN, KNIGHT } from "../_lib/rules";

function perft(p: Pos, d: number): number {
  const ms = legalMoves(p);
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += perft(makeMove(p, m).pos, d - 1);
  return n;
}

test("perft thế ban đầu: 20 / 400 / 8902 / 197281", () => {
  const p = fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.deepEqual([1, 2, 3, 4].map((d) => perft(p, d)), [20, 400, 8902, 197281]);
});

test("perft Kiwipete (nhập thành, phong cấp, bắt qua đường): 48 / 2039 / 97862", () => {
  const p = fromFEN("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
  assert.deepEqual([1, 2, 3].map((d) => perft(p, d)), [48, 2039, 97862]);
});

test("perft thế 3 (bắt qua đường để lộ vua): 14 / 191 / 2812 / 43238", () => {
  const p = fromFEN("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
  assert.deepEqual([1, 2, 3, 4].map((d) => perft(p, d)), [14, 191, 2812, 43238]);
});

test("perft thế 4 (phong cấp, nhập thành bị chặn): 6 / 264 / 9467", () => {
  const p = fromFEN("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1");
  assert.deepEqual([1, 2, 3].map((d) => perft(p, d)), [6, 264, 9467]);
});

function play(g: ChessState, moves: string[]): ChessState {
  for (const mv of moves) {
    const f = sq("abcdefgh".indexOf(mv[0]), 8 - Number(mv[1]));
    const t = sq("abcdefgh".indexOf(mv[2]), 8 - Number(mv[3]));
    const pr = mv[4] === "n" ? KNIGHT : mv[4] === "q" ? QUEEN : 0;
    const r = applyMove(g, f, t, pr);
    assert.ok(r.ok, `nước ${mv}`);
    if (!r.ok) throw new Error(mv);
    g = r.state;
  }
  return g;
}

test("chiếu hết nhanh (Fool's mate) và SAN", () => {
  const g = play(newGame(), ["f2f3", "e7e5", "g2g4", "d8h4"]);
  assert.equal(g.winner, -1);
  assert.equal(g.endReason, "checkmate");
  assert.deepEqual(g.san, ["f3", "e5", "g4", "Qh4#"]);
});

test("hết nước (pat) là hoà", () => {
  // Vua đen h8, vua trắng g6; hậu e7 -> f7: đen không bị chiếu nhưng hết nước
  const g = newGame("7k/4Q3/6K1/8/8/8/8/8 w - - 0 1");
  const r = applyMove(g, sq(4, 1), sq(5, 1));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.state.draw, true);
    assert.equal(r.state.endReason, "stalemate");
  }
});

test("lặp lại 3 lần là hoà; không đủ quân là hoà", () => {
  const g = play(newGame(), ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
  assert.equal(g.endReason, "repetition");
  const k = applyMove(newGame("8/8/8/4k3/8/8/3n4/4K3 w - - 0 1"), sq(4, 7), sq(3, 6));
  assert.ok(k.ok && k.state.endReason === "material");
});

test("nhập thành, bắt qua đường, phong cấp và SAN tương ứng", () => {
  const g = play(newGame(), ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6", "a6a5", "g1f3", "a5a4", "f1e2", "a4a3", "e1g1"]);
  assert.deepEqual(g.san.slice(-7), ["exd6", "a5", "Nf3", "a4", "Be2", "a3", "O-O"]);
  assert.equal(g.captures[4], -6);
  const p = play(newGame("8/P6k/8/8/8/8/8/K7 w - - 0 1"), ["a7a8n"]);
  assert.equal(p.san[0], "a8=N");
  assert.equal(p.b[sq(0, 0)], KNIGHT);
});
