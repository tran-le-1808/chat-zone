#!/usr/bin/env python3
"""
Sinh bản đồ gốc "Nhà tù Đá Xám" (grey_stone) ở định dạng Tiled JSON + tileset 16 px.
Chạy: python3 scripts/gen-grey-stone-map.py
Sau đó có thể mở app/games/prison/_lib/engine/maps/grey_stone.map.json bằng Tiled để chỉnh tay;
engine chỉ đọc file JSON (không đọc script này).

Lớp: floor, walls (tile), zones, areas, objects, spawns, guard_routes, escape, lights, cameras.
1 ô = 1 đơn vị thế giới. Lưới 64 × 44 ô, ô 16 px.
"""
import json
import os
import struct
import zlib

W, H, T = 64, 44, 16
ROOT = os.path.join(os.path.dirname(__file__), "..", "app/games/prison/_lib/engine/maps")

# ------------------------------------------------------------------ bảng ô (ký tự -> tên, màu tileset)
TILES = [
    ("#", "Tường", (58, 62, 74)),
    (".", "Sàn", (148, 152, 160)),
    (",", "Sân cỏ", (86, 120, 70)),
    ("o", "Bên ngoài", (52, 84, 52)),
    ("d", "Cửa mở", (150, 110, 70)),
    ("L", "Cửa văn phòng (thẻ cai ngục)", (190, 160, 40)),
    ("R", "Cửa biệt giam", (120, 40, 40)),
    ("V", "Lưới thông gió", (90, 100, 110)),
    ("W", "Tường trèo được", (80, 80, 96)),
    ("b", "Giường", (180, 170, 150)),
    ("=", "Bàn", (120, 90, 60)),
    ("k", "Tủ / thùng lục soát", (110, 80, 50)),
    ("B", "Bàn chế tạo", (100, 70, 40)),
    ("S", "Kho nhóm", (90, 60, 110)),
    ("$", "Quầy căng tin", (200, 150, 60)),
    ("t", "Bồn cầu", (220, 225, 230)),
    ("J", "Máy làm việc", (100, 110, 120)),
    ("P", "Bảng điều khiển", (40, 120, 160)),
    ("G", "Cổng xe tải", (70, 70, 70)),
    ("x", "Bụi cây", (40, 100, 40)),
    ("g", "Máy tập gym", (130, 130, 140)),
    ("s", "Vòi sen", (120, 170, 200)),
    ("F", "Hàng rào thép gai", (160, 160, 150)),
    ("K", "Cửa kho (chìa kho)", (170, 120, 30)),
    ("c", "Cửa xà lim (khoá 21:00–08:00)", (110, 110, 120)),
    ("u", "Ống thông gió (bò được khi mở lưới)", (70, 76, 84)),
    ("T", "Tháp canh", (90, 70, 50)),
    ("X", "Xe (giặt / hàng)", (200, 200, 210)),
]
GID = {ch: i + 1 for i, (ch, _, _) in enumerate(TILES)}

g = [["o"] * W for _ in range(H)]


def rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch


def put(x, y, ch):
    g[y][x] = ch


# ------------------------------------------------------------------ khung: tường ngoài, sàn
rect(2, 2, 61, 41, "#")
rect(3, 3, 60, 40, ".")

# Sân chơi (Bắc-Tây) với hàng rào đôi ở phía Bắc
rect(3, 2, 44, 2, "F")  # rào ngoài
rect(3, 3, 44, 3, ",")  # vành đai giữa 2 lớp rào (cấm)
rect(3, 4, 44, 4, "F")  # rào trong
rect(3, 5, 44, 11, ",")
put(3, 5, "T")  # tháp canh T1
put(44, 5, "T")  # tháp canh T2
put(40, 10, "x")
rect(45, 3, 45, 11, "#")

# Cổng xe tải (Bắc-Đông)
rect(46, 3, 60, 11, ".")
put(61, 6, "G")
put(61, 7, "G")
rect(55, 5, 58, 6, "X")  # xe hàng đỗ
# Phòng điện (cạnh kho)
rect(46, 7, 52, 7, "#")
rect(46, 7, 46, 11, "#")
rect(52, 7, 52, 11, "#")
put(51, 8, "P")

# Dãy phòng 2: giặt | lối ra sân | nhà ăn | xưởng | kho
rect(3, 12, 60, 12, "#")
rect(12, 12, 14, 12, ".")  # lối ra sân
put(49, 12, "d")  # kho -> phòng điện
put(56, 12, "d")  # kho -> sân xe tải
for x in (11, 15, 28, 41, 59):
    rect(x, 13, x, 19, "#")
rect(60, 13, 60, 40, "#")
rect(3, 20, 60, 20, "#")
rect(12, 20, 14, 20, ".")
for x in (7, 21, 25, 34):
    put(x, 20, "d")
put(41, 16, "K")  # cửa sau xưởng -> kho
# cửa thông nội bộ dãy 2 (giặt - lối ra sân - nhà ăn - xưởng): tuyến xưởng / sân không phải đi qua hành lang
for x in (11, 15, 28):
    put(x, 16, "d")
put(59, 16, "V")  # lưới thông gió phía kho
# nội thất dãy 2
put(3, 13, "k")
put(6, 13, "J")
put(10, 19, "k")
rect(8, 16, 9, 16, "X")  # xe giặt
rect(20, 13, 21, 13, "$")
put(27, 13, "k")
put(16, 19, "k")
for y in (15, 17):
    rect(18, y, 25, y, "=")
put(29, 13, "k")
put(40, 19, "k")
put(29, 19, "k")
put(34, 18, "J")
rect(31, 15, 37, 15, "=")
put(43, 13, "k")
put(58, 19, "k")
put(50, 19, "k")
rect(45, 16, 55, 16, "=")  # kệ hàng trong kho

# Hành lang trung tâm y=21..23
rect(59, 21, 59, 23, "#")  # ống gió nằm sau tường hành lang
rect(3, 24, 60, 24, "#")
rect(12, 24, 14, 24, ".")
rect(45, 24, 47, 24, ".")
put(7, 24, "L")  # văn phòng
for x in (19, 27, 38, 51):
    put(x, 24, "d")

# Dãy phòng 4: văn phòng | lối xà lim A | y tế | tắm | gym | lối xà lim B | thư viện (+ phòng trong)
for x in (11, 15, 23, 32, 44, 48, 55, 59):
    rect(x, 25, x, 31, "#")
put(55, 28, "d")  # thư viện -> phòng nhỏ
put(59, 29, "V")  # lưới thông gió trong phòng nhỏ
rect(60, 16, 60, 29, "u")  # ống thông gió nối thư viện -> kho
rect(3, 32, 60, 32, "#")
rect(12, 32, 14, 32, ".")
rect(45, 32, 47, 32, ".")
# nội thất dãy 4
put(4, 25, "P")
put(10, 25, "k")
put(3, 31, "k")
rect(5, 28, 8, 28, "=")
put(22, 25, "k")
put(16, 28, "b")
put(17, 28, "b")
put(16, 30, "b")
put(17, 30, "b")
for x in (24, 26, 28, 30):
    put(x, 31, "s")
for x in (34, 37, 40):
    put(x, 26, "g")
    put(x, 30, "g")
put(49, 31, "k")

# Xà lim A (6 phòng), xà lim B (6 phòng), khu biệt giam + kho tịch thu
rect(3, 36, 59, 36, "#")
CELLS_A = [3, 7, 11, 15, 19, 23]  # A-1..A-6
CELLS_B = [27, 31, 35, 39, 43, 47]  # B-1..B-6
for x0 in CELLS_A + CELLS_B:
    if x0 + 3 <= 59:
        rect(x0 + 3, 37, x0 + 3, 40, "#")
    put(x0 + 1, 36, "c")
    put(x0, 37, "b")
    put(x0, 38, "b")  # giường dọc 2 ô, đầu giường phía trên
    put(x0 + 2, 37, "k")
    put(x0 + 2, 40, "t")
rect(26, 33, 26, 40, "#")
put(26, 34, "d")  # cửa thông khu xà lim A - B
rect(50, 33, 50, 40, "#")
put(50, 34, "d")
put(25, 33, "S")
# biệt giam
for x0, door in ((51, 52), (55, 56)):
    put(door, 36, "R")
rect(54, 37, 54, 40, "#")
for bx in (51, 55):  # giường ngang trong phòng biệt giam
    put(bx, 40, "b")
    put(bx + 1, 40, "b")
rect(58, 37, 58, 40, "#")
put(59, 36, "d")
put(59, 40, "k")

# ------------------------------------------------------------------ đối tượng Tiled
oid = [1]


def obj(name, typ, x, y, w=0, h=0, props=None, polyline=None):
    o = {"id": oid[0], "name": name, "type": typ, "x": x * T, "y": y * T, "width": w * T, "height": h * T, "rotation": 0, "visible": True}
    if polyline is not None:
        o["polyline"] = [{"x": (px - x) * T, "y": (py - y) * T} for px, py in polyline]
    if props:
        o["properties"] = [{"name": k, "type": ptype(v), "value": v} for k, v in props.items()]
    oid[0] += 1
    return o


def ptype(v):
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    return "string"


def tile_obj(name, typ, x0, y0, x1=None, y1=None, **props):
    x1 = x0 if x1 is None else x1
    y1 = y0 if y1 is None else y1
    return obj(name, typ, x0, y0, x1 - x0 + 1, y1 - y0 + 1, props or None)


zones = []


def zone(zid, label, *rects):
    for (x0, y0, x1, y1) in rects:
        zones.append(obj(zid, "zone", x0, y0, x1 - x0 + 1, y1 - y0 + 1, {"label": label}))


CELL_ORDER = [CELLS_A[2], CELLS_A[1], CELLS_A[3], CELLS_A[4], CELLS_A[0], CELLS_A[5]] + CELLS_B
CELL_LABEL = {x: f"Xà lim A-{i + 1}" for i, x in enumerate(CELLS_A)} | {x: f"Xà lim B-{i + 1}" for i, x in enumerate(CELLS_B)}
for i, x0 in enumerate(CELL_ORDER):
    zone(f"cell_{i}", CELL_LABEL[x0], (x0, 37, x0 + 2, 40))
zone("solitary_0", "Biệt giam 1", (51, 37, 53, 40))
zone("solitary_1", "Biệt giam 2", (55, 37, 57, 40))
zone("solitary", "Khu biệt giam", (51, 33, 59, 35))
zone("confiscation", "Kho tịch thu", (59, 37, 59, 40))
zone("block_a", "Khu xà lim A", (3, 33, 25, 35))
zone("block_b", "Khu xà lim B", (27, 33, 49, 35))
zone("hall", "Hành lang trung tâm", (3, 21, 58, 23), (12, 12, 14, 20), (12, 24, 14, 32), (45, 24, 47, 32))
zone("laundry", "Phòng giặt", (3, 13, 10, 19))
zone("canteen", "Nhà ăn", (16, 13, 27, 19))
zone("workshop", "Xưởng", (29, 13, 40, 19))
zone("storage", "Kho", (42, 13, 58, 19))
zone("office", "Văn phòng cai ngục", (3, 25, 10, 31))
zone("infirmary", "Phòng y tế", (16, 25, 22, 31))
zone("shower", "Phòng tắm", (24, 25, 31, 31))
zone("gym", "Gym", (33, 25, 43, 31))
zone("library", "Thư viện", (49, 25, 54, 31), (56, 25, 58, 31))
zone("yard", "Sân chơi", (3, 5, 44, 11))
zone("fence_strip", "Vành đai hàng rào", (3, 3, 44, 3))
zone("truck_gate", "Cổng xe tải", (46, 3, 60, 6), (53, 7, 60, 11))
zone("power", "Phòng điện", (47, 8, 51, 11))
zone("outside", "Rừng / bãi ngoài", (0, 0, W, H))

areas = [obj("rollcall", "area", 18, 7, 10, 3, {"label": "Vạch điểm danh"})]

objects = []
LOOT_DESK = "spoon,cloth,plastic,clothes,photo"
for i, x0 in enumerate(CELL_ORDER):
    lab = CELL_LABEL[x0]
    objects.append(tile_obj(f"desk_{i}", "container", x0 + 2, 37, label=f"Bàn {lab}", loot=LOOT_DESK, slots=6, refill=False))
    objects.append(tile_obj(f"toilet_{i}", "hideSpot", x0 + 2, 40, label=f"Sau bồn cầu ({lab})", safety=0.7, cellIndex=i, capacity=4))
    objects.append(tile_obj(f"bedrest_{i}", "bed", x0, 37, x0, 38, label=f"Giường {lab}", cellIndex=i, bed=True, canStore=False, canHideUnder=False, orientation="vertical", headSide="top", sleepAnchorX=x0 + 0.5, sleepAnchorY=38.0, wakeTileX=x0, wakeTileY=39))
    if x0 in CELLS_A:
        objects.append(tile_obj(f"tunnel_{i}", "tunnelSpot", x0, 40, label=f"Góc sàn đào được ({lab})", cellIndex=i))
objects += [
    tile_obj("sol_door_0", "solitaryDoor", 52, 36, label="Cửa biệt giam 1", solitaryIndex=0),
    tile_obj("sol_door_1", "solitaryDoor", 56, 36, label="Cửa biệt giam 2", solitaryIndex=1),
    tile_obj("evidence_locker", "evidenceLocker", 59, 40, label="Kho tịch thu (đồ bị thu)"),
    tile_obj("stash", "stash", 25, 33, label="Kho nhóm (hốc tường cuối khu A)"),
    # văn phòng
    tile_obj("camera_panel", "cameraPanel", 4, 25, label="Bàn điều khiển camera"),
    tile_obj("office_board", "container", 10, 25, label="Bảng chìa khoá & thẻ", loot="key_mold,keycard,ink"),
    tile_obj("office_files", "container", 3, 31, label="Tủ hồ sơ", loot="ink,photo,file,food,tape"),
    # nhà ăn
    tile_obj("shop", "shop", 20, 13, 21, 13, label="Quầy căng tin"),
    tile_obj("pantry", "container", 27, 13, label="Kho bếp", loot="food,food,plastic,sugar,flour"),
    tile_obj("canteen_bin", "container", 16, 19, label="Thùng rác nhà ăn", loot="plastic,spoon,food,sugar,glass"),
    # xưởng
    tile_obj("job_plates", "job", 34, 18, label="Máy cắt biển số", zone="workshop"),
    tile_obj("toolbox_0", "container", 29, 13, label="Hộp dụng cụ", loot="metal_scrap,wire,file,adhesive,tape"),
    tile_obj("toolbox_1", "container", 40, 19, label="Thùng phế liệu", loot="metal_scrap,plastic,wire,battery,gear_parts"),
    tile_obj("lumber", "container", 29, 19, label="Đống gỗ vụn", loot="wood,wood,metal_scrap"),
    # phòng giặt
    tile_obj("job_laundry", "job", 6, 13, label="Máy giặt công nghiệp", zone="laundry"),
    tile_obj("washer_0", "container", 3, 13, label="Kệ đồ gửi giặt", loot="cloth,cloth,guard_outfit,pillow,blanket,clothes"),
    tile_obj("washer_1", "container", 10, 19, label="Giỏ đồ bẩn", loot="cloth,cloth,wire,pillow,blanket,clothes"),
    tile_obj("laundry_cart", "vehicle", 8, 16, 9, 16, label="Xe giặt (ra cổng 10:00)", vehicle="laundry"),
    # kho + cổng xe tải + phòng điện
    tile_obj("crate_0", "container", 43, 13, label="Thùng hàng", loot="metal_scrap,wire,wood,circuit_board,metal_sheet,gear_parts"),
    tile_obj("crate_1", "container", 58, 19, label="Thùng linh kiện", loot="battery,wire,plastic,circuit_board"),
    tile_obj("crate_2", "container", 50, 19, label="Thùng dụng cụ", loot="metal_scrap,metal_scrap,plastic,wood,metal_sheet,adhesive"),
    tile_obj("supply_truck", "vehicle", 55, 5, 58, 6, label="Xe hàng (14:00–14:20)", vehicle="supply"),
    tile_obj("gate", "gate", 61, 6, 61, 7, label="Cổng xe tải"),
    tile_obj("power_panel", "powerPanel", 51, 8, label="Tủ điện tổng"),
    tile_obj("vent", "vent", 59, 29, label="Lưới thông gió (phòng trong thư viện)"),
    tile_obj("vent_storage", "vent", 59, 16, label="Lưới thông gió (kho)"),
    # thư viện
    tile_obj("shelf_0", "container", 49, 31, label="Kệ tạp chí", loot="wire,plastic,ink,photo"),
    tile_obj("book_0", "hideSpot", 54, 31, label="Cuốn sách khoét rỗng", safety=0.55, cellIndex=-1, capacity=4),
    tile_obj("bookshelf_0", "bookshelf", 49, 25, label="Kệ sách lịch sử", topic="history"),
    tile_obj("bookshelf_1", "bookshelf", 50, 25, label="Kệ sách khoa học", topic="science"),
    tile_obj("bookshelf_2", "bookshelf", 52, 25, label="Kệ sách cơ khí", topic="mechanics"),
    tile_obj("bookshelf_3", "bookshelf", 53, 25, label="Kệ sách luật", topic="law"),
    tile_obj("bookshelf_4", "bookshelf", 49, 28, label="Kệ sách y học", topic="medicine"),
    tile_obj("bookshelf_5", "bookshelf", 54, 28, label="Kệ sách văn học", topic="literature"),
    # y tế, tắm, gym
    tile_obj("med_cabinet", "container", 22, 25, label="Tủ thuốc", loot="bandage,bandage,food,pillow,tape"),
    tile_obj("bedrest_infirm", "bed", 16, 28, 17, 28, label="Giường phòng y tế 1", bed=True, canStore=False, canHideUnder=False, orientation="horizontal", headSide="left", sleepAnchorX=17.0, sleepAnchorY=28.5, wakeTileX=18, wakeTileY=28),
    tile_obj("bedrest_infirm_1", "bed", 16, 30, 17, 30, label="Giường phòng y tế 2", bed=True, canStore=False, canHideUnder=False, orientation="horizontal", headSide="left", sleepAnchorX=17.0, sleepAnchorY=30.5, wakeTileX=18, wakeTileY=30),
    tile_obj("bedrest_sol_0", "bed", 51, 40, 52, 40, label="Giường biệt giam 1", bed=True, canStore=False, canHideUnder=False, orientation="horizontal", headSide="left", sleepAnchorX=52.0, sleepAnchorY=40.5, wakeTileX=53, wakeTileY=40),
    tile_obj("bedrest_sol_1", "bed", 55, 40, 56, 40, label="Giường biệt giam 2", bed=True, canStore=False, canHideUnder=False, orientation="horizontal", headSide="left", sleepAnchorX=56.0, sleepAnchorY=40.5, wakeTileX=57, wakeTileY=40),
    *[tile_obj(f"shower_{i}", "shower", x, 31, label="Vòi sen", showerSpotX=x, showerSpotY=30) for i, x in enumerate((24, 26, 28, 30))],
    *[tile_obj(f"gym_{i}", "gym", x, y, label="Máy tập") for i, (x, y) in enumerate([(34, 26), (37, 26), (40, 26), (34, 30), (37, 30), (40, 30)])],
    # sân + hàng rào
    tile_obj("bush_0", "hideSpot", 40, 10, label="Bụi cây góc sân", safety=0.5, cellIndex=-1, capacity=4),
    tile_obj("fence_inner", "fence", 3, 4, 44, 4, label="Hàng rào trong", ring="inner"),
    tile_obj("fence_outer", "fence", 3, 2, 44, 2, label="Hàng rào ngoài", ring="outer"),
]

spawns = []
for i, x0 in enumerate(CELL_ORDER):
    spawns.append(obj(f"cell_{i}", "cell", x0 + 1.5, 38.5, props={"index": i}))
NPC_CELLS = list(range(4, 12)) + [6, 7, 8, 9]
for i, ci in enumerate(NPC_CELLS):
    x0 = CELL_ORDER[ci]
    spawns.append(obj(f"inmate_{i}", "inmate", x0 + 1.5, 39.3 if i < 8 else 38.2, props={"index": i}))
spawns += [
    obj("solitaryInside_0", "solitaryInside", 52.5, 38.5, props={"index": 0}),
    obj("solitaryInside_1", "solitaryInside", 56.5, 38.5, props={"index": 1}),
    obj("solitaryRelease_0", "solitaryRelease", 52.5, 34.5, props={"index": 0}),
    obj("solitaryRelease_1", "solitaryRelease", 56.5, 34.5, props={"index": 1}),
    obj("tunnelExit", "tunnelExit", 1.0, 38.5, props={"label": "Bụi cây ngoài tường Tây"}),
    obj("infirmaryBed_0", "infirmaryBed", 17.0, 28.5, props={"index": 0, "bed": "bedrest_infirm"}),
    obj("infirmaryBed_1", "infirmaryBed", 17.0, 30.5, props={"index": 1, "bed": "bedrest_infirm_1"}),
    obj("drop_laundry", "vehicleDrop", 62.6, 13.5, props={"vehicle": "laundry"}),
    obj("drop_supply", "vehicleDrop", 62.6, 4.0, props={"vehicle": "supply"}),
    obj("tower_0", "tower", 3.5, 5.5, props={"label": "Tháp canh T1", "angle": 20, "sweep": 35, "period": 16}),
    obj("tower_1", "tower", 44.5, 5.5, props={"label": "Tháp canh T2", "angle": 160, "sweep": 35, "period": 16}),
]


def route(name, pts):
    return obj(name, "route", 0, 0, polyline=pts)


routes = [
    # tuyến 1 (ca ngày): quét hành lang 3 lượt rồi đi hết 2 khu xà lim (≈ 4 phút / vòng)
    route("cells", [(13.5, 22.5), (56.5, 22.5), (5.5, 22.5), (56.5, 22.5), (13.5, 22.5), (13.5, 34.5), (4.5, 34.5), (48.5, 34.5), (4.5, 34.5), (48.5, 34.5), (13.5, 34.5)]),
    # tuyến 2: phòng giặt + nhà ăn + xưởng, đi bằng cửa thông nội bộ
    route("work", [(6.5, 15.5), (13.5, 16.5), (21.5, 16.5), (25.5, 14.5), (34.5, 17.5), (38.5, 14.5), (34.5, 17.5), (21.5, 16.5), (13.5, 16.5)]),
    # tuyến 3: sân + cổng xe tải (qua nhà ăn, xưởng, kho)
    route("yard", [(13.5, 9.5), (25.5, 6.5), (40.5, 8.5), (30.5, 10.5), (13.5, 10.5), (13.5, 16.5), (21.5, 16.5), (34.5, 16.5), (39.5, 16.5), (48.5, 14.5), (56.5, 10.5), (50.5, 4.5), (56.5, 10.5), (48.5, 14.5), (39.5, 16.5), (34.5, 16.5), (21.5, 16.5), (13.5, 16.5)]),
    # ca đêm: hành lang + kiểm tra xà lim A / B
    route("night_a", [(13.5, 22.5), (4.5, 22.5), (30.5, 22.5), (13.5, 22.5), (13.5, 34.5), (4.5, 34.5), (24.5, 34.5), (13.5, 34.5)]),
    route("night_b", [(46.5, 22.5), (56.5, 22.5), (30.5, 22.5), (46.5, 22.5), (46.5, 34.5), (48.5, 34.5), (28.5, 34.5), (46.5, 34.5)]),
    # cai ngục nghỉ ca trong văn phòng
    route("office", [(5.5, 27.5), (8.5, 30.5)]),
]

exits = [
    obj("exit_sw", "exit", 1.0, 41.0, props={"method": "TUNNEL", "label": "Ô thoát Tây-Nam"}),
    obj("exit_s", "exit", 32.0, 42.8, props={"method": "FENCE", "label": "Ô thoát Nam"}),
    obj("exit_e", "exit", 62.8, 30.5, props={"method": "LAUNDRY", "label": "Ô thoát Đông"}),
    obj("exit_truck", "exit", 62.8, 8.5, props={"method": "GATE", "label": "Sau cổng xe tải"}),
]

lights = []
for i, x0 in enumerate(CELL_ORDER):
    lights.append(obj(f"light_cell_{i}", "light", x0 + 1.5, 38.2, props={"radius": 2.2, "cell": True}))
for i, (x, y) in enumerate([(8, 22), (20, 22), (32, 22), (44, 22), (55, 22), (8, 34), (20, 34), (32, 34), (44, 34), (55, 34), (8, 8), (22, 8), (36, 8), (53, 5), (53, 10), (6, 16), (22, 16), (35, 16), (50, 16), (7, 28), (19, 28), (28, 28), (38, 28), (52, 28), (49, 9)]):
    lights.append(obj(f"light_{i}", "light", x, y, props={"radius": 4.2, "cell": False}))

cameras = [
    obj("C1", "camera", 3.6, 21.4, props={"label": "C1 hành lang Tây", "angle": 0}),
    obj("C2", "camera", 58.4, 21.4, props={"label": "C2 hành lang Đông", "angle": 180}),
    obj("C3", "camera", 29.6, 13.6, props={"label": "C3 xưởng", "angle": 45}),
    obj("C4", "camera", 43.6, 6.0, props={"label": "C4 sân", "angle": 160, "range": 8}),
    obj("C5", "camera", 58.4, 13.6, props={"label": "C5 kho", "angle": 150}),
    obj("C6", "camera", 10.4, 25.6, props={"label": "C6 văn phòng", "angle": 135}),
    obj("C7", "camera", 58.4, 33.6, props={"label": "C7 biệt giam", "angle": 180}),
    obj("C8", "camera", 60.4, 3.6, props={"label": "C8 cổng xe tải", "angle": 135}),
]

# ------------------------------------------------------------------ xuất JSON + tileset
floor_data, wall_data = [], []
WALLISH = set("#FTGV")
for y in range(H):
    for x in range(W):
        ch = g[y][x]
        base = "o" if ch in "oF" and (y < 2 or y > 41 or x < 2 or x > 61) else ("," if ch in ",FTx" else ".")
        if ch == "o":
            base = "o"
        floor_data.append(GID[base])
        wall_data.append(0 if ch in (".", ",", "o") else GID[ch])


def layer(lid, name, data=None, objs=None):
    if data is not None:
        return {"id": lid, "name": name, "type": "tilelayer", "width": W, "height": H, "data": data, "opacity": 1, "visible": True, "x": 0, "y": 0}
    return {"id": lid, "name": name, "type": "objectgroup", "draworder": "topdown", "objects": objs, "opacity": 1, "visible": True, "x": 0, "y": 0}


tileset = {
    "firstgid": 1,
    "name": "grey_stone",
    "tilewidth": T,
    "tileheight": T,
    "tilecount": len(TILES),
    "columns": len(TILES),
    "image": "grey_stone-tiles.png",
    "imagewidth": T * len(TILES),
    "imageheight": T,
    "margin": 0,
    "spacing": 0,
    "tiles": [{"id": i, "properties": [{"name": "ch", "type": "string", "value": ch}, {"name": "name", "type": "string", "value": nm}]} for i, (ch, nm, _) in enumerate(TILES)],
}
layers = [
    layer(1, "floor", floor_data),
    layer(2, "walls", wall_data),
    layer(3, "zones", objs=zones),
    layer(4, "areas", objs=areas),
    layer(5, "objects", objs=objects),
    layer(6, "spawns", objs=spawns),
    layer(7, "guard_routes", objs=routes),
    layer(8, "escape", objs=exits),
    layer(9, "lights", objs=lights),
    layer(10, "cameras", objs=cameras),
]
tmj = {
    "type": "map",
    "version": "1.10",
    "tiledversion": "1.10.2",
    "orientation": "orthogonal",
    "renderorder": "right-down",
    "infinite": False,
    "width": W,
    "height": H,
    "tilewidth": T,
    "tileheight": T,
    "nextlayerid": len(layers) + 1,
    "nextobjectid": oid[0],
    "properties": [{"name": "id", "type": "string", "value": "grey_stone"}, {"name": "name", "type": "string", "value": "Nhà tù Đá Xám"}],
    "tilesets": [tileset],
    "layers": layers,
}
with open(os.path.join(ROOT, "grey_stone.map.json"), "w", encoding="utf-8") as f:
    json.dump(tmj, f, ensure_ascii=False, indent=1)


def png(path, w, h, pixel):
    raw = b"".join(b"\x00" + b"".join(bytes(pixel(x, y)) for x in range(w)) for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def tile_px(x, y):
    i = x // T
    r, gg, b = TILES[i][2]
    edge = (x % T in (0, T - 1)) or (y in (0, T - 1))
    return (max(0, r - 25), max(0, gg - 25), max(0, b - 25)) if edge else (r, gg, b)


png(os.path.join(ROOT, "grey_stone-tiles.png"), T * len(TILES), T, tile_px)
print("\n".join("".join(r) for r in g))
