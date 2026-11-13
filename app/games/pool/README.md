# Bida Lỗ (Pool) — 8 bi & 9 bi, luật WPA

## Kiến trúc

```
chat-zone/app/games/pool/
  _lib/physics/   Engine vật lý (nguồn chính, dùng chung client & server)
    math.ts         Toán xác định: dsin/dcos/dlen (chỉ + − × ÷ √) + băm trạng thái FNV-1a
    config.ts       Thông số SI, preset lỗ (Dễ / WPA Thi đấu / Pro)
    table.ts        Hình học bàn 9 ft: mũi băng, điểm mũi lỗ, mũi lỗ bo tròn, thềm, hố rơi, thành sau lỗ
    motion.ts       Trượt / lăn / xoáy đứng — nghiệm giải tích theo pha
    collisions.ts   Bi–bi (throw, truyền xoáy), bi–băng (mũi băng cao hơn tâm, phục hồi tiếp tuyến)
    cue.ts          Cú đánh: xung lực trên vật rắn, squirt, massé, trượt cơ
    simulator.ts    Bước 0.5 ms + CCD (lùi về đúng thời điểm chạm), pha rơi lỗ, ShotResult, ShotTrace
  _lib/rules/     Trọng tài WPA 8 bi / 9 bi (chỉ đọc ShotResult), xếp bi, đặt lại bi, hết giờ
  _lib/protocol.ts Giao thức online (phiên bản, kiểu thông điệp, kiểm tra input, mã lỗi)
  _lib/ai.ts      Máy đánh (dùng chính engine + trọng tài để thử cú)
  _components/    Giao diện 3D (three.js / R3F), điều khiển, HUD, online
  _tests/         Test Node (node --test)

login-system/src/pool/        Server có thẩm quyền (NestJS + socket.io)
  shared/                     BẢN SAO tự động của physics/rules/protocol (npm run pool:sync-shared)
  pool-room.service.ts        Phòng, trận, kiểm tra input, mô phỏng, đồng hồ, replay
  pool.gateway.ts             Sự kiện socket `pool:*`, ghép trận ELO, khán giả, kết nối lại
  pool-stats.service.ts       ELO 8 bi / 9 bi, lịch sử trận + replay (MongoDB)
  pool.controller.ts          GET /pool/me, GET /pool/matches/:id
```

**Vì sao server tính hết?** Server là nguồn chân lý duy nhất (vật lý, luật, vị trí bi, đồng hồ).
Client gửi input; người đánh mô phỏng cục bộ ngay khi bấm (không trễ) rồi đối chiếu hash với
`SHOT_RESULT`; đối thủ / khán giả mô phỏng lại từ input. Vì engine chỉ dùng phép toán IEEE-754 xác
định nên hash luôn khớp (đã kiểm Node ↔ Chrome); nếu lệch, client nội suy về trạng thái server ~150 ms.

## Vật lý bay (jump shot) & cơ vướng

- **Đánh chúi:** bi nhận vận tốc tự do từ đầu cơ; thành phần đi xuống đập vào nỉ rồi nảy lên với hệ số
  `cueBounce` (0.35). Dưới `jumpMinVz` (0.25 m/s) bi vẫn nằm trên bàn — góc ≤ 3° không bao giờ nhảy.
  Ví dụ 45° + lực 60%: nhảy ~11 cm, nảy 3 lần rồi lăn.
- **Bay:** ném xiên giải tích (không ma sát không khí), chạm nỉ tính nghiệm đúng; đáp có phục hồi e = 0.5 và
  ma sát tiếp tuyến (đổi cả vận tốc lẫn spin); `landSettleVz` chặn nảy vô hạn.
- **Va chạm 3D:** bi bay cao hơn 2R thì bay qua bi nằm dưới; thấp hơn thì va chạm với pháp tuyến nghiêng.
  Bi bay cao hơn mũi băng (36.3 mm) thì vượt băng -> **văng khỏi bàn** (`ShotResult.offTable`):
  lỗi; bi 8 văng -> thua ván (hoặc đặt lại nếu lúc phá); bi 9 văng -> đặt lại.
- **Cơ vướng:** `checkCueClearance` (đầu cơ không chạm nỉ, thân cơ không đè băng / xuyên bi). Vướng băng nhẹ
  (cần nâng ≤ 6°) thì tự nâng đuôi cơ (`liftShot`, client & server cùng gọi, người xem cũng phải dựng lại cú
  đánh bằng `liftShot` để hash khớp); vướng bi hoặc cần nâng nhiều hơn -> server trả `CUE_BLOCKED`.
- **Đường ngắm:** bi ma, hướng bi cái sau va chạm (tiếp tuyến), đường bi mục tiêu tới bi chắn / băng đầu tiên,
  xanh lá + vòng quanh lỗ khi lọt miệng lỗ (khớp mô phỏng ≥ 85%). Chế độ "Đầy đủ" mô phỏng thật cả cú nhảy.
- **Camera:** góc nghiêng / sau cơ theo bi cái khi đang đánh rồi trở về góc mặc định (tắt được trong Cài đặt).

## Điều khiển đánh bi (dùng chung Bida Lỗ & Bida Carom)

Code ở `app/games/_shared/shot/` — kiểu 8 Ball Pool, không có nút "Đánh":

| Thao tác | Cách làm |
|---|---|
| Ngắm | **Chạm / click ở đâu trên bàn thì ngắm tới đó** (không cần kéo); kéo tiếp thì xoay mượt quanh bi cái (cảm ứng) hoặc bám theo con trỏ (chuột). Desktop: ←/→ chỉnh, giữ Shift để chỉnh mịn (0.05°) |
| Điểm chạm | Chạm bi cái nhỏ ở góc → phóng to; chấm đỏ bám ngón tay, kẹp trong vòng an toàn (Bida Lỗ: ≤ 0.5R, ngoài vòng = trượt cơ) |
| Lực + đánh | Kéo tay nắm ở thanh bên **xuống** (kéo lên để giảm) rồi **thả** = đánh; kéo về < 5% rồi thả = huỷ. Desktop: giữ Space, thả để đánh, Esc huỷ |
| Kéo cơ trên bàn | Cài đặt → "Kéo cơ trên bàn": chạm thân cơ, kéo lùi theo trục ngắm |
| Reset sau mỗi cú | Cài đặt → "Tự reset điểm chạm và góc cơ" (mặc định bật): điểm chạm về tâm, góc cơ về mặc định |

Dòng gợi ý trạng thái ("Kéo cơ xuống rồi thả để đánh", "Bi đang lăn…") nằm ở thanh trên, không phủ lên bàn.

Máy trạng thái `shotMachine.ts` (LOCKED → IDLE ⇄ AIMING → SPIN_EDIT / PULLING → SHOOTING) là hàm thuần,
có test ở `_tests/shot.test.ts`. Gói `SHOT` không đổi: UI chỉ là cách nhập `power`, `tipX/tipY`, hướng.
Lực: Bida Lỗ truyền thẳng mức kéo (engine đã có đường cong `p^1.5`); Bida Carom (engine tuyến tính) áp `d^1.4`.

## Giao thức (socket.io, tiền tố `pool:`)

| Client → Server | | Server → Client | |
|---|---|---|---|
| `join` / `create` / `list` / `quick` / `quick:cancel` | phòng, ghép trận | `room` | thông tin phòng |
| `ready`, `seat`, `settings`, `start`, `reset` (đấu lại) | phòng chờ | `state` | ROOM_STATE đầy đủ (seq, ván, đồng hồ, thống kê) |
| `aim` (≤ 15 Hz) | AIM_UPDATE | `aim` | cơ đối thủ |
| `place` | PLACE_CUE_BALL | `shot` | SHOT_RESULT: input, keyframes (sự kiện), final, hash, phán quyết |
| `option` | lựa chọn theo luật | `matched` | đã ghép trận |
| `shoot` | SHOT (kèm call / safety / pushOut, seq, clientStateHash) | `notice`, `chat`, `voice:*` | |
| `extend`, `resign`, `chat`, `ping`, `sync` | | | |

Mọi thông điệp có `v` (phiên bản giao thức). Lỗi trả về `{ ok: false, code, error }` với các mã
`NOT_YOUR_TURN`, `WRONG_PHASE`, `STALE_SEQ`, `OUT_OF_RANGE`, `STATE_MISMATCH`, `INVALID_PLACEMENT`, …

Đồng hồ: 30 s/cú, 60 s cho cú phá / cú đầu sau phá / khi có bi trong tay, gia hạn +30 s một lần mỗi
ván. Hết giờ = lỗi (đối thủ có bi trong tay). Mất kết nối: giữ ghế 60 s, đồng hồ tạm dừng; quá 60 s
xử thua.

## Chạy cục bộ

```bash
# backend (cổng 8000)            # frontend (cổng 3000)
cd login-system && npm run start:dev    cd chat-zone && npm run dev
```
Mở 2 cửa sổ trình duyệt (2 tài khoản) → Khu trò chơi → Bida Lỗ → Online → Tạo phòng → gửi mã/link.

Sửa engine / luật / giao thức ở `chat-zone/app/games/pool/_lib` rồi chạy `npm run pool:sync-shared`
(trong chat-zone) để chép sang backend.

## Test

```bash
cd chat-zone
npm run test:pool                         # vật lý, lỗ, hiệu chỉnh, luật, determinism client↔server
npm run pool:pocket-map                   # bản đồ tỉ lệ vào lỗ 10.000 cú/loại -> reports/pocket-map/*.csv|png
node scripts/pool-determinism-browser.mjs 300   # hash Node ↔ Chrome (cần dev server + đăng nhập: TOKEN=...)

cd login-system
npx jest src/pool                         # server: input sai, đồng hồ, kết nối lại, bot 2 client qua WebSocket
POOL_SOAK_RACKS=100 npx jest src/pool/pool.gateway.e2e.spec.ts   # chạy dài: 100 ván 8 bi + 100 ván 9 bi
```

## Triển khai

Không thêm hạ tầng mới: chạy cùng backend NestJS hiện có (Render) và frontend Next.js (Vercel),
socket.io qua WSS sẵn có, MongoDB lưu ELO / lịch sử / replay (collection `poolratings`, `poolmatches`).
Phòng sống trong bộ nhớ của 1 tiến trình; muốn scale ngang cần sticky session + Redis adapter cho
socket.io (chưa cấu hình).
