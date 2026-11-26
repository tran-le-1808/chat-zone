# Prison Break – Last Chance

Game vượt ngục 2D nhìn từ trên xuống: sinh hoạt theo lịch, lục soát và chế tạo, giữ độ nghi ngờ thấp, rồi chọn một trong bốn lối thoát. Có chế độ chơi đơn (chạy trong trình duyệt) và co-op 1–4 người (server có thẩm quyền).

Toàn bộ tên, bản đồ, hình ảnh và âm thanh đều tự làm. Xem [CREDITS.md](CREDITS.md).

## Chạy

```bash
# backend (NestJS + Socket.IO, namespace /game)
cd login-system && npm run start:dev
# frontend (Next.js)
cd chat-zone && npm run dev
```

Mở `/games/prison`. Chơi đơn không cần backend. Trang này vẫn nằm sau màn đăng nhập của hub.

## Điều khiển

| Máy tính | Hành động |
|---|---|
| Phím mũi tên | Di chuyển (Shift để chạy) |
| E | Tương tác (các lựa chọn khác hiện thành nút) |
| 1–6 | Chọn ô túi chính (bấm lại để dùng / mặc). Khi bị cai ngục hỏi: chọn câu trả lời |
| I · C · Q · T · P | Túi đồ · Chế tạo · Nhiệm vụ · Đồng đội · Kế hoạch đào tẩu |
| Tab | Nhật ký |
| Space | Tạm dừng (chơi đơn) |
| − / + | Thu nhỏ / phóng to |
| X | Huỷ thao tác đang giữ |
| A | Đánh (giữ để đánh liên tục) |
| R | Rút / cất vũ khí ở ô vũ khí |

- **Tay cầm:** cần trái để đi, A tương tác, B đóng, X túi đồ, Y nhật ký, RB chạy, LB đánh, LT rút/cất vũ khí, Start tạm dừng.
- **Điện thoại:** joystick ảo bên trái, nút E và nút ⚔️ (đánh) bên phải. Chơi ở chế độ ngang.

## Cấu trúc

```
_lib/engine/      Engine luật chơi thuần TypeScript (dùng chung client & server, test bằng Node)
  data/*.json     Mọi dữ liệu & hệ số: vật phẩm, công thức, giá, lịch, cai ngục, tù nhân, vai trò, cân bằng
  maps/*.map.json Bản đồ Tiled + tileset PNG
  world.ts        Vòng tick tất định (lịch, nhu cầu, AI, camera, đào tẩu)
  rules.ts        Lịch sinh hoạt, vi phạm leo thang, va chạm, bắt/thả
  guards.ts       AI cai ngục: tuần tra, tầm nhìn, nghi ngờ, khám phòng, A*
  npc.ts          Tù nhân NPC: lịch riêng, tính cách, mua bán, mách lẻo
  hiding.ts       Ô giấu đồ & khám phòng (cả bàn trong phòng và hình nộm)
  containers.ts   Tủ / thùng / bàn: lưới ô, cất vào – lấy ra, bổ sung đồ mỗi sáng
  bedding.ts      Giường (gối, chăn — không giấu đồ), hình nộm (độ chân thực), kiểm tra đêm
  wanted.ts       Truy nã 1–3 sao sau 21:00, phong toả cửa khu, giảm dần
  combat.ts       Đánh nhau: đòn cận chiến, vũ khí & sát thương, trang bị, hạ gục
  tunnel.ts       Đào hầm
  economy.ts      Căng tin (cung cầu), việc làm
  cameras.ts      Camera an ninh
  escape.ts       4 lối thoát & chiến thắng chung
_lib/art/         Bảng màu giới hạn + sprite pixel art vẽ bằng code
_lib/audio/       Âm thanh tổng hợp WebAudio + tính toán mix (thuần)
_lib/session/     Phiên chơi đơn (LocalSession, lưu IndexedDB) & co-op (NetSession: prediction/reconciliation)
_components/      Three.js scene, HUD, các panel
_tests/           Test Node (engine, bot vượt ngục, âm thanh, prediction)
```

Engine ở frontend là **nguồn chính**. Sau khi sửa, chép sang backend bằng `npm run prison:sync-shared`; lệnh này copy vào `login-system/src/prison/shared`.

## Chỉnh dữ liệu

Không có tên vật phẩm, giá hay hệ số nào viết cứng trong code. Sửa file JSON trong `_lib/engine/data/`:

| File | Nội dung |
|---|---|
| `items.json` | Vật phẩm: tên, loại, trọng lượng, đồ cấm, độ bền, giá gốc, ô (`slotType`), đồ ăn (`consumable`, `staminaRestore`, `cooldownSeconds`) |
| `recipes.json` | Công thức: `tier` (1–5), `intelligenceRequired`, `ingredients`, `craftSeconds`, `output` — không còn bản vẽ |
| `prices.json` | Hàng căng tin, độ tăng giá theo cầu, tốc độ hồi giá, giảm giá, tiền công |
| `routines.json` | 11 khung lịch (`start`, `end`, `requiredZone`, `activity`), đếm ngược trước khung, kiểm tra giữa ca, kiểm tra đêm (`nightChecks`), giờ khám phòng, giới hạn ngày |
| `guards.json` | Tuyến theo độ khó, tầm nhìn, tốc độ, nghi ngờ, mua chuộc |
| `inmates.json` | Tù nhân NPC: tính cách, `aggression`, `courage`, `groupId`, `grudges`, hàng bán, lời mách nước (đúng / sai) |
| `roles.json` | Vai trò & kỹ năng khởi đầu |
| `gym.json` | Phòng gym: `alwaysOpen`, máy (số máy / tù nhân, chỉ số, tối đa), nhịp mỗi lần theo mốc, hệ số HP / tấn công / tốc độ / thời gian thao tác, thể lực thấp, đà, tranh máy, giới hạn bấm |
| `confiscation.json` | Kho tịch thu: số ngày giữ (`keepDays`), hệ số giá chuộc, thời gian phá tủ tang vật, quy tắc tịch thu (đồ cấm / đồ vượt ngục / vũ khí) |
| `disguise.json` | Cải trang: tỉ lệ nhận ra (nhìn thoáng ngày/đêm, nhìn gần), tầm nhìn, thời gian chờ, độ bẩn/rách, câu hỏi & đáp án |
| `balance.json` | Còn lại (gồm `loot`: thời gian mở túi / lấy đồ / áo quần, heat khi bị thấy): tick, tốc độ, nhu cầu, heat, biệt giam, đào hầm, camera… |

Sau khi sửa: chạy `npm run test:prison`, rồi `npm run prison:sync-shared`.

## Bản đồ "Nhà tù Đá Xám" (grey_stone) — tạo / sửa bằng Tiled

Bản đồ gốc 64 × 44 ô (ô 16 px). Sinh lại từ script: `python3 scripts/gen-grey-stone-map.py`
(ghi `_lib/engine/maps/grey_stone.map.json` + `grey_stone-tiles.png`); sau đó có thể mở bằng
[Tiled](https://www.mapeditor.org/) 1.9+ để chỉnh tay. Engine chỉ đọc file JSON, không đọc script.

1. Lớp tile **floor** + **walls** (ô tường đè lên sàn). Mỗi tile có thuộc tính `ch` quyết định luật chơi:
   - `#` tường, `.` sàn, `,` sân, `o` bên ngoài, `d` cửa mở, `F` hàng rào thép gai (cắt / buộc dây).
   - Cửa có khoá theo `data/doors.json`: `c` cửa xà lim (khoá 21:00–08:00, Chìa phòng), `K` cửa kho (Chìa kho / thẻ),
     `L` cửa văn phòng (thẻ cai ngục thật / giả), `G` cổng xe tải (đồng phục + thẻ, hoặc mở khi xe hàng tới).
   - `R` cửa biệt giam, `V` lưới thông gió, `u` ống thông gió (bò được khi đã cậy lưới), `T` tháp canh, `X` xe.
   - Nội thất: `b` giường, `=` bàn, `k` tủ, `S` kho nhóm, `$` quầy, `t` bồn cầu, `J` máy làm việc, `P` bảng điều khiển, `x` bụi cây, `g` máy gym, `s` vòi sen.
2. Lớp object (*Class* của object là loại):

| Lớp | Object | Thuộc tính |
|---|---|---|
| `zones` | hình chữ nhật, tên = id khu (nhiều hình cùng tên = một khu) | `label`; mức an ninh & cờ khu xà lim lấy từ `data/zones.json` (an ninh 3 = khu cấm) |
| `areas` | `rollcall` = vạch điểm danh | — |
| `objects` | class `container`, `hideSpot`, `shop`, `stash`, `vent`, `fence` (`ring` = inner/outer), `vehicle` (`vehicle` = laundry/supply), `powerPanel`, `gate`, `solitaryDoor`, `bed`, `tunnelSpot`, `job`, `cameraPanel`, `bookshelf`, `gym`, `shower`, `evidenceLocker` | `label`, `loot`, `safety`, `capacity`, `cellIndex`, `solitaryIndex`, `zone`, `slots`, `refill` |
| `spawns` | `cell`, `inmate`, `solitaryInside`, `solitaryRelease` (`index`); `tunnelExit`; `vehicleDrop` (`vehicle`); `tower` (`angle`, `sweep`, `period`) | |
| `guard_routes` | polyline, tên = id tuyến (ca trực trong `data/patrols.json`) | — |
| `escape` | ô thoát ngoài tường | `label`, `method` |
| `lights` | đèn | `radius`, `cell` |
| `cameras` | camera C1–C8 | `label`, `angle` (+ tuỳ chọn `fov`, `range`, `period`, `sweep`, `blindRadius`; mặc định ở `data/cameras.json`) |

Thêm bản đồ mới: vẽ file Tiled theo đúng các lớp trên, đặt cạnh `grey_stone.map.json` rồi đổi dòng
`import rawMap from "./maps/…"` trong `_lib/engine/map.ts`; mọi luật đọc từ dữ liệu bản đồ + `data/*.json`.

### 5 lối vượt ngục (`data/escapes.json`)

| Lối | Cần | Ô thoát |
|---|---|---|
| Đường hầm (xà lim khu A) | Dụng cụ đào (bậc 4), thanh chống, hình nộm khi đào đêm; 12 đoạn | Tây-Nam |
| Ống thông gió (thư viện → kho) | Dao mài / Tua vít cậy lưới; né camera C5; xe hàng 14:00–14:20 mở cổng | sau cổng xe tải |
| Cải trang + thẻ | Áo + quần cai ngục, thẻ (thật / giả bậc 4) | sau cổng xe tải |
| Xe giặt | Trốn vào xe giặt trước 10:00; có thể bị kiểm tra xe | Đông |
| Cắt điện + vượt rào | Thiết bị phá điện (bậc 5, mất điện 90 giây), Kìm cắt rào / Dây leo cao, né tháp canh | Nam / Đông |

Bot kiểm thử từng lối: `_tests/escape-bots.test.ts`; nghiệm thu bản đồ: `_tests/map.test.ts`.

## Test

```bash
cd chat-zone && npm run test:prison         # engine, bot 4 lối thoát, âm thanh, prediction
cd login-system && npx jest src/prison      # phòng chờ, mô phỏng, lưu trữ, e2e 4 socket thật
```

## Tủ, giường & hình nộm

- **Tủ / thùng / bàn:** bấm E mở modal lưới ô (như rương). Bấm ô để chuyển cả ô giữa tủ và túi, chuột phải để chuyển 1 món. Tủ công cộng được bổ sung đồ ngẫu nhiên lúc 06:00; bàn trong phòng giam thì không. Nhiệm vụ "lục soát" tính một lần mỗi tủ mỗi ngày.
- **Giường:** chỉ để ngủ hồi sức. Mỗi giường có sẵn 1 gối + 1 chăn, lấy ra hoặc đặt lại được (kể cả giường khác, kể cả giường buồng B và phòng y tế). Gối và chăn còn có thể nằm trong máy giặt, tủ thuốc.
- **Hình nộm:** ghép từ 2 gối + 1 chăn (không cần bàn chế tạo), đặt lên giường. Giường có hình nộm thì không ngủ được.
- **Kiểm tra đêm** (22:00 và 02:00, chỉnh ở `routines.json` → `nightCheckTimes`): ai không ở phòng mình mà giường không có hình nộm sẽ bị **phát lệnh truy nã** (`balance.json` → `nightCheck`): cai ngục thấy là truy đuổi, trại tăng báo động. Có hình nộm thì cai ngục bị đánh lừa. Khám phòng ban ngày (10:00, 15:00) vẫn có thể lộ hình nộm và đồ cấm trong bàn.

## Đánh nhau & vũ khí

- **Đánh:** phím A vung theo hướng đang quay mặt (cung 110°, có tầm, không đánh xuyên tường). Mỗi đòn có hồi chiêu; đánh hụt vẫn mất hồi chiêu.
- **Trang bị:** vũ khí nằm ở **ô vũ khí riêng** (không chiếm túi chính), chỉ mang được 1. R để rút/cất; cất thì đánh tay không. Nhặt/lục được vũ khí mới thì vũ khí cũ rơi xuống đất.
- **Vũ khí** (`items.json`, mục `weapon`): tay không 8 · Dao mài 14 · Gậy gỗ 17 · Ống thép 22 · Dùi cui 26 sát thương. Dao mài (thìa + giũa, cần bàn), Gậy (2 gỗ + vải), Ống thép (2 kim loại + vải, cần bàn); dùi cui chỉ có khi hạ gục cai ngục hoặc trong tủ đồ tịch thu. Vũ khí mòn mỗi đòn trúng và là đồ cấm.
- **Sát thương** = vũ khí × (1 + Sức mạnh + Thể lực) × đánh lén (×1,5 khi đánh từ phía sau) × dao động ±10%. Chỉnh trong `balance.json` → `combat`.
- **Mục tiêu:** cai ngục (60 máu) và tù nhân (40 máu). Đồng đội không bị đánh nhầm.
  - Cai ngục bị đánh sẽ quay lại truy đuổi; hạ gục thì họ nằm 90 giây (xem mục lục soát bên dưới). Cai ngục cần ở trong tầm tóm 0,8 giây mới khống chế được nên bạn kịp đánh trả.
  - Tù nhân bị hạ gục nằm một lúc và có thể bị lục soát; tù nhân nóng tính (Hai Búa) đánh trả. Thua trận đánh thì tự tỉnh lại sau 20 giây thay vì bị bắt.
- **Luật tù:** đánh nhau trong tầm nhìn cai ngục hoặc camera là vi phạm nghiêm trọng; cầm vũ khí ra ngoài là vi phạm (nhắc nhở → phạt → nghiêm trọng).

## Bổ sung: giường, lịch 11 khung, chế tạo mọi nơi, đánh nhau, truy nã, hình nộm

- **Lịch** (`routines.json`): 08:00 thức dậy · 08:30 điểm danh · 09:00 làm nhiệm vụ · 11:00 ăn trưa · 13:00 làm nhiệm vụ · 15:00 gym · 16:00 tắm · 17:00 ăn tối · 19:00 điểm danh · (19:30 nghỉ) · 20:00 tự do · 21:00 đi ngủ, đèn tắt. Chuông kêu đúng giờ; thanh đếm ngược hiện trước mỗi khung `bellBeforeMinutes` phút game. Bỏ việc giữa ca bị trừ tiền công; không tắm bị trừ uy tín; ngủ ngoài giờ cho phép là vi phạm. Khu gym (máy tập, tăng Thể lực) và phòng tắm (vòi sen) có trên bản đồ.
- **Giường:** thức dậy trên giường lúc 08:00 (màn ngắn, bấm để bỏ qua). Chỉ nằm / dậy; không mở, không chứa, không giấu được đồ (thuộc tính `bed`, `canStore: false`, `canHideUnder: false` trong bản đồ). Đồ đặt trên giường bị lộ khi khám phòng. Chỗ giấu trong xà lim là sau bồn cầu (đã bỏ hẳn gạch lỏng dưới sàn).
- **Chế tạo:** ở bất kỳ đâu, không cần bàn. Chế tạo trước mặt cai ngục bị ghi vi phạm; chế tạo đồ cấm bị phát hiện ngay (cả camera). Bị đánh / di chuyển thì dừng, nguyên liệu còn nguyên.
- **Truy nã** (`balance.json` → `wanted`): sau 21:00 ra khỏi xà lim mà bị cai ngục thấy → 1★; bị thấy lại sau `redetectCooldownMinutes` hoặc ở ngoài quá `levelUpOutsideMinutes` → thêm sao (tối đa 3). Gọi tăng viện theo bán kính từng mức; từ 2★ có còi và phong toả cửa khu (cửa thường chỉ qua được khi có Kẹp mở khóa / Thẻ từ). Không bị ai thấy `decayMinutes` thì giảm 1★. Bị bắt khi đang truy nã: biệt giam lâu hơn, mất một phần đồ thường.
- **Hình nộm** (chăn + gối + quần áo): có độ chân thực 0–100 theo Khéo tay (Mechanic +15). Kiểm tra đêm (`nightChecks`): *nhìn thoáng* (22:00, 00:00, 04:00) — hình nộm tốt và trời tối dễ qua mắt, thanh nghi ngờ phụ tăng dần; *điểm danh đêm* (02:00) — gọi tên, hình nộm lộ trừ khi đồng đội đứng trong xà lim bấm "Trả lời điểm danh" trong 10 giây. Lộ khi đang ở ngoài → truy nã; ở trong phòng → vi phạm nhẹ, bị thu. Không tránh được điểm danh 08:30 / 19:00.
- **Tù nhân đánh nhau** (`balance.json` → `combat.ai`): trạng thái `idle`, `threatened`, `fighting`, `retreating`, `knockedOut`; phản ứng sau 0,3–0,8 giây. Người hung hăng đánh trả, người hiền thường bỏ chạy; máu thấp hoặc cai ngục tới gần (theo `courage`) thì bỏ chạy. Người cùng nhóm thấy thì có thể lao vào (tối đa 3 người một trận). Người nóng tính có thù hoặc gặp người có uy tín xấu với nhóm mình sẽ chủ động gây sự; người chơi có thể đánh trả hoặc "Bỏ chạy & báo cai ngục". Ai ngất cũng được đưa tới phòng y tế rồi tỉnh lại.

## Lục soát, túi 6 ô + trang bị, cải trang cai ngục

- **Túi đồ:** túi chính 6 ô (`balance.json` → `player.inventorySlots`) + 3 ô trang bị riêng: vũ khí, áo, quần. Mỗi vật phẩm có `slotType` trong `items.json` (`bag` / `weapon` / `top` / `bottom`); server từ chối đặt sai ô.
- **Mặc đồ:** bấm áo/quần trong túi → Mặc; đồ đang mặc trả về túi, túi đầy thì rơi xuống đất. Áo/quần tù mang **mã chủ** (`TN-xxxx`); mặc áo của tù nhân khác, chủ áo gặp sẽ nhận ra và gây sự.
- **Lục soát** (E cạnh người đang ngất — tù nhân hoặc cai ngục): mở túi 3 giây, lấy mỗi món 0,5 giây, áo/quần 2 giây (`balance.json` → `loot`). Di chuyển, bị đánh hoặc nạn nhân tỉnh dậy là dừng. Cai ngục khác thấy bạn đang lục → vi phạm nặng, heat tăng mạnh, bị truy đuổi.
- **Tù nhân tỉnh dậy thấy mất đồ:** người hung hăng (`aggression` ≥ 0,6) ghi thù và trả thù, người hiền báo cai ngục (heat tăng). Người cùng nhóm có thể lao vào khi bạn đánh (tối đa 3 người một trận).
- **Đánh ngất cai ngục:** cai ngục khác không biết ngay. Họ phát hiện khi thấy người nằm ngất hoặc khi điểm danh thiếu → điều tra khu đó + báo động nhỏ (`guards.json` → `missingAlarmHeat`). Tỉnh dậy, cai ngục được tăng cường (máu ×1,5, tầm nhìn ×1,2), lấy lại trang bị và khai ra kẻ tấn công. Mỗi cai ngục chỉ bị đánh ngất 1 lần mỗi ngày.
- **Cải trang** (mặc cả áo + quần cai ngục, mã `CN-xxx` của cai ngục bị lột):
  - Nhìn thoáng từ xa: thường qua mắt (ban đêm dễ hơn).
  - Nhìn gần: cai ngục kiểm mã trên áo — mã của người **đang trực** là lộ ngay; mã hợp lệ vẫn có xác suất bị nghi, đồ bẩn/rách (`condition`, giảm khi bị đánh) tăng rủi ro.
  - Đồng nghiệp đứng gần sẽ **hỏi** (hộp thoại, 8 giây): đúng thì qua, sai/hết giờ thì lộ. Đáp án có thể nghe được từ lời mách của tù nhân.
  - Lộ thì bị truy đuổi và mất tác dụng cải trang 5 phút. Nằm trong xà lim lúc điểm danh khi đang mặc đồ cai ngục là bị phát hiện. Bị bắt thì bị tịch thu đồ cai ngục, trả lại đồ tù.
- **Socket:** `loot:start`, `loot:take`, `loot:close`, `gear:wear`, `gear:take-off`, `gear:drop-weapon`, `disguise:answer` — đều qua DTO, có `requestId` chống lặp; client chỉ gửi ý định.

## Phòng gym: máy đẩy tạ & máy chạy bộ

- **Số máy** mỗi loại = số tù nhân trong trại (tù nhân NPC + người chơi chưa thoát), tính lại liên tục — thêm/bớt tù nhân thì số máy đổi theo; ai đang dùng máy bị dỡ thì phải rời. Mỗi máy một người, hàng chờ 1 người. Máy vẽ ở mép trên (đẩy tạ) và mép dưới (chạy bộ) khu gym.
- **Mở cả ngày** (`gym.json` → `alwaysOpen`); 15:00–16:00 chỉ là giờ gym trong lịch. Bấm E ở máy tập để mở bảng chọn máy.
- **Nhịp:** bấm xen kẽ TRÁI – PHẢI (← / → hoặc A / D; điện thoại: 2 nút lớn, rung khi bấm). Mỗi cặp đúng = 1 nhịp. Bấm cùng bên 2 lần = mất đà (thanh đà về 0, nhịp của lần đang tập về 0; Thể lực cao giữ lại tới 50%).
- **Lần (rep):** 10 nhịp (chỉ số 0–20), 12 (21–35), 15 (36–50) → +1 đúng một điểm, tối đa 50. Thể lực < 20: ×1,2 nhịp; đói hoặc máu < 30%: ×1,1. Mỗi lần −4 thể lực (tập dở tính theo tỉ lệ nhịp); dưới 4 thể lực thì máy dừng, không cho bắt đầu lần mới. Nghỉ (X), bị đánh: lần dở không tính, các lần đã xong vẫn giữ.
- **Sức mạnh** (đẩy tạ): HP tối đa = gốc + sức mạnh × 2 (máu hiện tại tăng theo phần chênh, không hồi đầy); tấn công × (1 + sức mạnh × 0,02).
- **Nhanh nhẹn** (chạy bộ): tốc độ × (1 + nhanh nhẹn × 0,01), trần ×1,5; đào hầm, tháo nắp ống, buộc dây trèo rào nhanh hơn tối đa 20%. Không có thưởng riêng khi thoát đuổi bắt (chỉ nhờ tốc độ).
- **Tranh máy:** tù nhân NPC dùng máy riêng của mình (theo thứ tự). Người chơi đang chiếm máy đó thì tù nhân hiền **xin** (nhường → họ lên máy; từ chối → −uy tín với tù nhân, họ đứng chờ), tù nhân hung hăng **đòi** (từ chối hoặc không trả lời → bị gây sự). Mỗi tù nhân tranh máy tối đa 1 lần/ngày.
- **Socket:** `gym:start`, `gym:press` (giới hạn riêng 16 lần/giây), `gym:stop`, `gym:answer` — qua DTO, có `requestId` chống lặp.
- **Sửa lỗi kèm theo:** khu `gym` và `shower` trước đây bị khu `outside` che mất trên lưới khu (nên điểm danh ở gym / nhà tắm không bao giờ đúng). Giờ `outside` luôn được xét sau cùng.

## Thể lực, thông minh, chế tạo theo thông minh, thư viện & đồ ăn

- **Thể lực** (trường `stats.energy`, tối đa 100, thanh ⚡ xanh dương; thay cho thanh Mệt cũ, đã bỏ):
  - Tiêu hao: mỗi lần gym hoàn thành −4 (tập dở tính theo tỉ lệ nhịp), đào −2, trèo rào −6 (buộc dây và trèo ra), chế tạo −1 mỗi lần, chạy −1 mỗi giây.
  - Hết thể lực: không tập gym / chạy bộ, không đào, không trèo; vẫn đi bộ và làm việc nhẹ (làm việc, chế tạo). Dưới 20: thanh nhấp nháy, đi chậm 15%.
  - Hồi: ngủ trên giường +4 mỗi giây (mọi lúc, tự dậy khi đầy); tắm xong trong giờ tắm (16:00–17:00) +30 (bị gián đoạn thì không); đồ ăn bổ sung. Không còn tự hồi khi đứng yên.
  - Không hồi khi nghỉ trong khu cấm hoặc đang bị truy nã.
  - Số liệu: `balance.json` → `stamina` (`staminaMax`, `gymStaminaCost`, `digCost`, `climbCost`, `craftSecondsPerPoint`, `bedRestPerSecond`, `showerRestore`, `fullNightMinutes`, `lowThreshold`, `lowSpeedMultiplier`).
- **Thông minh** (`stats.intelligence`, 🧠 trên HUD): bắt đầu 20, tối đa 50, tối thiểu 0. Mỗi 08:00 −2 (thông báo "Ngày mới: thông minh −2").
  - **Thư viện:** 6 kệ sách (`bookshelf_*` trong lớp `interactables` của bản đồ Tiled, có thuộc tính `label`, `topic`). Đứng cạnh kệ bấm E, đứng yên đọc 5 giây → +1. Mỗi kệ chờ 60 phút game mới cộng lại (đọc sớm vẫn được nhưng không cộng). Mở cả ngày (`intelligence.alwaysOpen`). Di chuyển: dừng, không cộng. Nhật ký: "Đọc kệ sách lịch sử, thông minh 21/50".
  - Số liệu: `balance.json` → `intelligence`.
- **Chế tạo:** bỏ hẳn bản vẽ. Vẫn chế tạo ở bất kỳ đâu. Cần đủ nguyên liệu + đủ thông minh theo bậc:

  | Bậc | Thông minh | Công thức |
  |---|---|---|
  | 1 – Cơ bản | 0 | Thanh chống, Gậy gỗ, Nước tăng lực tự pha |
  | 2 – Hữu ích | 15 | Dao mài, Kẹp mở khóa, Ống thép, Bánh năng lượng, Socola tự làm |
  | 3 – Quan trọng | 25 | Chìa khóa giả, Tua vít, Hình nộm |
  | 4 – Nâng cao | 35 | Xẻng tự chế |
  | 5 – Then chốt | 45 | Dây thừng (trèo rào) |

  - Tỉ lệ thành công: vừa đủ ngưỡng 70%, mỗi điểm dư +2,5%, dư 10 điểm trở lên 95% (trần). Khéo tay (+10% ở 100) và Thợ máy (+5%) vẫn cộng nhưng không vượt 95%. Thất bại mất 50% tổng nguyên liệu (làm tròn), không bị trừ thông minh. Số liệu: `balance.json` → `crafting`.
- **Đồ ăn bổ sung thể lực** (ăn ngay, mỗi món chờ 30 giây, không vượt 100): Socola +25, Bánh năng lượng +20, Sữa đặc +15 (căng tin bán); Socola tự làm +18 (2 đường + 1 bột, bậc 2); Nước tăng lực tự pha +10 (đường + nhựa, bậc 1). Đường & bột có trong tủ bếp căng tin. Không phải đồ cấm.
- Kỹ năng `fitness` cũ giờ hiển thị là **Sức bền** để không trùng tên với thanh Thể lực.

## Điều chỉnh gameplay: mở cả ngày, ngủ giường, nhân vật nhỏ, chơi một mình, tịch thu, âm thanh, chế tạo tức thì

- **Thư viện & phòng gym mở 24/24**, kể cả đêm và giờ điểm danh. Các luật khác vẫn giữ: ra khỏi xà lim sau 21:00 bị thấy là truy nã, vắng điểm danh vẫn bị ghi vi phạm, bỏ việc giữa ca vẫn bị trừ tiền công.
- **Ngủ trên giường** (E ở giường của mình → "Ngủ", X hoặc nút "Dậy" để dậy): mọi lúc, +4 thể lực mỗi giây (`stamina.bedSleepStaminaPerSecond`). Màn hình tối đi, có nút tua ×1/×2/×4 (chơi đơn). Tự dậy khi đầy 100, lúc 08:00, khi bị đánh, khi cai ngục gọi tên lúc đêm, và **trước mỗi giờ điểm danh** (kèm chuông cảnh báo) — ngủ không miễn điểm danh. Giường vẫn không giấu đồ; hình nộm như cũ.
- **Bỏ hẳn gạch lỏng dưới sàn** (dữ liệu, bản đồ, giao diện, bước khám phòng). Kho nhóm giờ là "hốc tường cuối hành lang".
- **Nhân vật nhỏ gọn:** hộp va chạm 1/2 ô cho người chơi, cai ngục, tù nhân (`player.radius` = `guards.radius` = 0,25). Đi qua cửa 1 ô dễ, hai người đi song song được. **Tốc độ 1 ô mỗi bước** (`player.stepSeconds` 0,25 giây → 4 ô/giây); Nhanh nhẹn vẫn nhân vào như cũ.
- **Chơi một mình — "qua ngày mới":** bị bắt thì không ngồi biệt giam nhiều ngày. Nhân vật vào phòng biệt giam, màn hình chuyển cảnh ngủ, thời gian nhảy tới 08:00 kế tiếp (các mốc lịch ở giữa vẫn chạy: bổ sung đồ, nửa đêm, hết hạn ngày; người bị giam không bị tính vắng). Thức dậy trong phòng biệt giam với thể lực 100, thông minh −2 (do qua ngày), vài giây sau được thả về xà lim. Nhật ký ghi vi phạm và số đêm bị giam. Cờ `solitary.soloMode` (balance.json) và `world.soloMode`; chơi nhiều người giữ biệt giam cũ.
- **Tịch thu khi bị bắt:** vũ khí (ô vũ khí), đồ vượt ngục (`escapeItem: true` trong items.json: dây thừng, tua vít, xẻng, kẹp, chìa giả, thẻ từ, thanh chống, hình nộm, đồng phục cai ngục, đất), đồ cấm (`contraband`). Giữ lại: đồ ăn, thuốc, nguyên liệu thường, áo quần tù, tiền trong mức quy định. Đồ bị tịch thu vào **kho tịch thu** — chuộc lại bằng hối lộ cai ngục (giá × 1,5, hiện trong gợi ý E), hoặc **phá tủ tang vật** trong phòng bảo vệ (khu cấm, 4 giây); quá 3 ngày bị huỷ lúc 08:00. Bảng "Đã bị tịch thu" tự mở khi bị bắt.
- **Âm thanh** (tự sáng tác bằng WebAudio, xem CREDITS.md):
  - Chuông điểm danh 08:30 & 19:00 (3 hồi, toàn bản đồ, nhỏ hơn trong phòng kín), chuông cảnh báo trước 1 phút (kèm thanh đếm ngược), chuông kết thúc 09:00 & 19:30. Số phút cảnh báo: `rollcall.warningMinutes`.
  - Nhạc nền sinh động nhiều lớp (bass + pad, giai điệu, trống/hi-hat), 3 đoạn A-B-A-C luân phiên với biến tấu; mỗi khu một biến thể (gym nhanh, thư viện nhẹ, xà lim đêm rất nhẹ); chuyển khu đổi nhạc mượt 1,5 giây. Nghi ngờ cao / bị đuổi → lớp căng thẳng.
  - Còi truy nã bật ngay khi bị truy nã, to/cao/dồn dập hơn theo số sao, viền màn hình đỏ nhấp nháy; hết truy nã tắt dần trong 1 giây.
  - Ưu tiên mix: còi > chuông điểm danh > hiệu ứng > nhạc nền (nhạc nền hạ khi có còi / chuông).
- **Chế tạo tức thì:** bấm là ra vật phẩm, không thanh tiến trình, không bị gián đoạn. Vẫn cần đủ nguyên liệu + điểm thông minh, tỉ lệ thành công như cũ, thất bại mất 50% nguyên liệu, −1 thể lực mỗi lần. Cai ngục / camera thấy đúng lúc chế tạo vẫn bị ghi vi phạm.
- **Socket mới:** `guard:reclaim` (chuộc đồ tịch thu).
- **Lưu game:** phiên bản cấu trúc thế giới là 9; bản lưu cũ hơn không tải được.

## Knock out solo, giường theo chiều, 1 bộ đồ, cải trang tuyệt đối, camera

- **Chơi một mình bị đánh ngất (hết máu):** tua nhanh 30 phút game (vẫn chạy lịch), tỉnh dậy **nằm trên giường phòng y tế**; thể lực 100, sức mạnh −1, nhanh nhẹn −1 (không dưới 0), máu 50%, miễn bị đánh 2 phút game; điểm danh trong lúc bất tỉnh không bị ghi vắng (y tế xác nhận). Bị tù nhân đánh ngất không tịch thu; bị cai ngục bắt thì tịch thu (`data/knockout.json`, `balance.json → knockout`).
- **Giường có hướng:** thuộc tính Tiled `orientation`, `headSide`, `sleepAnchorX/Y`, `wakeTileX/Y`. Ngủ / tỉnh ở y tế: nhân vật nằm đúng điểm nằm, xoay theo trục giường, chăn che từ cổ trở xuống; bấm di chuyển để ngồi dậy ở ô kế chân giường (bị chắn thì ô trống gần nhất).
- **1 bộ đồ:** túi = 6 ô + 1 ô vũ khí + 1 ô bộ đồ (`prisoner_outfit`, `guard_outfit`). Cởi đồ: còn đồ lót (sprite áo ba lỗ + quần đùi), bộ đồ vào túi hoặc rơi xuống đất. Ra hành lang / sân khi chỉ mặc đồ lót: vi phạm nhỏ, tù nhân bình luận (`disguise.json → outfitRequiredOutsideCell`). Save cũ (áo + quần riêng) được nâng cấp bằng `_lib/engine/migrate.ts`.
- **Cải trang:** mặc bộ đồ cai ngục là thành cai ngục — sprite / minimap / nhãn "Cai ngục"; cai ngục, camera, tháp canh không bao giờ nhận ra danh tính, không truy nã sau 21:00, vào khu cấm không vi phạm, điểm danh bỏ qua (`bypassRollCall`). Chỉ khi bị thấy phạm tội (đánh nhau, đào, phá hoại, lục soát, vũ khí lộ…) mới báo động và mất cải trang tạm thời.
- **Camera** (`_components/cameraMath.ts`): luôn đặt nhân vật ở giữa màn hình, zoom nguyên 16 px × k theo cạnh ngắn của màn hình, sát biên thì kẹp, bản đồ nhỏ hơn màn hình thì căn giữa, không lerp (dịch chuyển là đặt ngay). Thêm `?debugCamera=1` vào URL để xem chữ thập tâm màn hình, khung biên bản đồ, toạ độ nhân vật và kích thước viewport.

## UI gọn, phòng tắm, ngủ mọi lúc, gym bấm là tập, thời gian ×0.5, đào tường / hầm, cai ngục bênh, ảnh treo & thảm

- **UI:** mặc định không có chữ hướng dẫn giữa màn hình (`ui.json → showHints: false`, bật lại trong Cài đặt). HUD chỉ còn sức khoẻ / thể lực / đói; `C` = chỉ số, `M` = bản đồ (tên từng khu, chấm vị trí nhấp nháy, không hiện cai ngục / camera), `I` túi, `Tab` nhật ký, `F` chế tạo, `Esc` đóng. Thông báo nhỏ ở góc trên phải, tối đa 3 dòng, tự tắt sau 2,5 giây.
- **Phòng tắm:** vòi luôn xả; đứng ô dưới vòi (`showerSpot`) +4 thể lực/giây mọi giờ; tự cởi bộ đồ lên giá và mặc lại khi bước ra (`balance.json → shower`). Phạt không tắm mặc định tắt.
- **Ngủ:** mọi lúc (kể cả thể lực đầy), mọi giường trống; không tự dậy khi đầy; dậy bằng nút Dậy hoặc sự kiện (bị đánh, gọi tên, chuông điểm danh, 08:00 nếu `autoWakeAt8`). Khi nằm: nhân vật bị khoá ở điểm nằm, phím di chuyển bị bỏ qua (cả dự đoán phía client), chống bấm lặp 300 ms. Chủ xà lim nhắc / ghi thù người lạ nằm giường mình. Bản đồ được kiểm tra khi nạp: mọi giường phải có điểm nằm và ô dậy hợp lệ.
- **Gym:** bấm vào máy là tập (ở xa thì tự đi tới); máy bận không vào được (`gym.json → queueEnabled: false`); thanh tiến trình nhỏ trên máy + khung nhỏ ở góc; lên / xuống / Esc / bấm lại máy để rời.
- **Thời gian:** mọi thao tác có thanh tiến trình × `actionTimeScale` (0.5). Chế tạo vẫn tức thì; cooldown, lịch, knock out không đổi.
- **Đào** (`digging.ts`, `tiles.json`, `tools.json`, `dig.json`): Muỗng mài (cấp 1) đục vách mỏng giữa hai xà lim / sàn đất; Dụng cụ đào (cấp 2) đục tường thường / sàn xi măng; tường ngoài không đào được. Lỗ tường đi qua được; đào sàn mở miệng hầm, xuống hầm đào ngang từng ô, đào ngược lên ở ô khác (ra ngoài chỉ khi đang đào tẩu). Kiệt sức có thể sập.
- **Vật che** (`concealers.json`): Ảnh treo tường che lỗ tường, Thảm chân che miệng hầm (bậc 2, thông minh 15). Chưa che: cai ngục thấy trong 3 ô là lấp lại ngay; đã che: chỉ lộ khi khám phòng (ảnh 25%, thảm 20%).
- **Cai ngục bênh** (`combat.json`): thấy tù nhân gây hấn đánh người chơi thì lao tới khống chế tù nhân đó; người bị đánh không bị phạt; đánh trả trong 5 giây là phòng vệ chính đáng; người chơi đánh trước vẫn bị phạt như cũ.

## Chế tạo mở rộng: nguyên liệu, linh kiện, công cụ nhiều cấp, sửa chữa

- **Không bản vẽ, chế tạo ra ngay** (giữ luật cũ): công thức mở theo Thông minh (bậc 1–5 = 0/15/25/35/45). Chế ×1 / ×5 / Tối đa (≤ 10) trong một yêu cầu, mỗi lần kiểm lại nguyên liệu và sức chứa.
- **Nhóm & độ hiếm** cho mọi vật phẩm (`items.json → category, rarity`): nguyên liệu thô, linh kiện, công cụ, vũ khí, cải trang, hỗ trợ, đặc biệt. Bảng Chế tạo (phím F) có tab theo nhóm, trạng thái từng công thức, nguyên liệu có / cần.
- **Nguyên liệu mới:** Keo dán, Băng dính, Tấm kim loại, Mảnh kính, Bánh răng cũ (có trong tủ xưởng / kho / văn phòng và NPC bán). **Linh kiện:** Linh kiện kim loại, Cụm cơ khí, Mạch điện tự chế, Vật liệu gia cố.
- **Công cụ theo vai trò** (`tools.json`, `tools.ts`): đào (cấp + hiệu quả theo tường / sàn / hầm), cậy, cắt rào, mở khoá. Xẻng gia cố, Cuốc chim (tự chế / thép), Kìm cắt thép, Xà beng (cậy nhanh nhưng ồn — cai ngục nghe thấy), Bộ mở khoá tinh, Dao đa năng (làm được nhiều việc nhưng kém đồ chuyên dụng). Nâng cấp = công cụ cũ + vật liệu. Hết độ bền thì gãy, mất (luật cũ).
- **Hỗ trợ:** Bộ sửa chữa (+50% độ bền cho món mòn nhất, không vượt tối đa), Túi đeo hông (+2 ô), Pháo tự chế (dụ cai ngục tới chỗ nổ), Sơ đồ chép tay (thấy cai ngục 90 giây). **Cải trang:** Bộ đồ công nhân (giờ làm việc được vào kho / phòng điện / sân xe tải).
