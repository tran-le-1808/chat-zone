# Credits & giấy phép tài sản

Prison Break – Last Chance là game **cùng thể loại** mô phỏng nhà tù 2D. Game không dùng tên, logo, sprite, nhạc, hiệu ứng âm thanh, bản đồ hay giao diện của bất kỳ game thương mại nào. Tên nhân vật, nơi chốn ("Trại giam Hắc Thạch", các tù nhân, các cai ngục) đều tự đặt.

| Tài sản | Nguồn | Giấy phép |
|---|---|---|
| Sprite nhân vật (cai ngục, tù nhân, người chơi) | Vẽ bằng code: `_lib/art/sprites.ts`, bảng màu `_lib/art/palette.ts` | Tự làm, thuộc dự án |
| Tile bản đồ, đèn, hiệu ứng | Vẽ bằng code: `_components/mapTexture.ts`, `_components/PrisonScene.tsx` | Tự làm, thuộc dự án |
| Tileset dùng cho Tiled (`maps/grey_stone-tiles.png`, `maps/blackstone-tiles.png`) | Ảnh màu phẳng sinh bằng script | Tự làm, thuộc dự án |
| Bản đồ `maps/grey_stone.map.json` (Nhà tù Đá Xám, đang dùng) và `maps/blackstone.map.json` (bản cũ) | Thiết kế riêng cho dự án | Tự làm, thuộc dự án |
| Nhạc nền nhiều lớp (bass/pad, giai điệu, trống), 3 đoạn A-B-A-C, biến thể theo khu (gym, thư viện, xà lim đêm…), lớp căng thẳng | Sáng tác bằng code, tổng hợp thời gian thực bằng WebAudio: `_lib/audio/audioManager.ts` | Nhạc gốc, tự làm, thuộc dự án |
| Hiệu ứng âm thanh (bước chân, chuông điểm danh / cảnh báo / kết thúc, cửa, khoá, đào, nước, còi truy nã theo số sao, đèn tắt, bong bóng thoại) | Tổng hợp WebAudio (oscillator + noise), không có file âm thanh | Tự làm, thuộc dự án |
| Biểu tượng vật phẩm | Emoji hệ thống (Unicode) — hiển thị bằng font của thiết bị | Font hệ thống của người dùng |
| Icon giao diện | [lucide-react](https://lucide.dev) (đã có trong dự án) | ISC |
| Engine hiển thị | three.js, @react-three/fiber (đã có trong dự án) | MIT |

**Không có file âm thanh hay ảnh nào lấy từ bên ngoài.** Nếu sau này thêm nhạc hoặc âm thanh CC0 / CC-BY, phải ghi vào bảng trên kèm tác giả, link và giấy phép.

Test `bản quyền` trong `_tests/spec.test.ts` quét mã nguồn game để chặn tên của game gốc lọt vào.
