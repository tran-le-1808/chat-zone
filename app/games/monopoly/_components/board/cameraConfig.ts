import * as THREE from "three";

/**
 * Cấu hình & thuật toán fit camera bàn cờ — MỘT nơi duy nhất để tinh chỉnh góc nhìn.
 * Chỉ camera thay đổi (không xoay/scale group bàn cờ) nên toạ độ logic của ô,
 * quân cờ, nhãn và raycast chọn ô giữ nguyên.
 *
 * Bàn hình thoi (xoay 45°) bị ép dọc khi nghiêng nên màn hình ngang dài (20:9) luôn
 * rộng hơn bàn. Giải pháp: hạ góc nghiêng theo tỉ lệ màn hình + "phóng đầy chiều rộng"
 * (cho phép cắt một phần hai góc trên/dưới) + camera tự theo quân cờ.
 */
export type BoardFitMode = "fillWidth" | "contain";

export interface BoardCameraConfig {
  /** FOV nhỏ -> gần trực giao: ô gần/xa cùng kích thước, chữ dãy xa không bị nhỏ đi */
  fov: number;
  near: number;
  far: number;
  /** Hướng nhìn quanh trục đứng (độ): 45 = nhìn từ góc XUẤT PHÁT (bàn hình thoi) */
  azimuthDeg: number;
  /** Nửa cạnh hộp bao quanh khung bàn & khoảng cao (để chiếu 8 đỉnh) */
  boxHalf: number;
  boxMinY: number;
  boxMaxY: number;
  /** Tỉ lệ bàn chiếm trong khung theo chiều rộng / cao khi fit (chừa chút lề) */
  fillRatio: number;
  /** Zoom bằng pinch / lăn chuột, kéo để pan, chạm đúp để về mặc định */
  enableZoom: boolean;
  minZoom: number;
  maxZoom: number;
  /** Pan tối đa (đơn vị thế giới) khi zoom lớn nhất */
  panLimit: number;
  /** Sau khi người chơi tự kéo/pinch thì tạm dừng tự theo quân cờ (ms) */
  followPauseMs: number;
}

export const BOARD_CAMERA: BoardCameraConfig = {
  fov: 14,
  near: 10,
  far: 600,
  azimuthDeg: 45,
  boxHalf: 14.3,
  boxMinY: -0.9,
  boxMaxY: 0.8,
  fillRatio: 0.97,
  enableZoom: true,
  minZoom: 1,
  maxZoom: 2.5,
  panLimit: 20,
  followPauseMs: 4000,
};

/** Hồ sơ camera theo tỉ lệ khung hình (rộng / cao) — chỉnh tại đây */
export interface AspectProfile {
  minAspect: number;
  elevationDeg: number;
  /** Mặc định phóng đầy chiều rộng; `maxCrop` = tỉ lệ chiều cao bàn được phép bị cắt */
  mode: BoardFitMode;
  maxCrop: number;
}
export const ASPECT_PROFILES: AspectProfile[] = [
  { minAspect: 2.0, elevationDeg: 40, mode: "fillWidth", maxCrop: 0.3 },
  { minAspect: 1.5, elevationDeg: 46, mode: "fillWidth", maxCrop: 0.18 },
  { minAspect: 1.2, elevationDeg: 50, mode: "contain", maxCrop: 0 },
  { minAspect: 0, elevationDeg: 60, mode: "contain", maxCrop: 0 },
];

export function profileForAspect(aspect: number): AspectProfile {
  return (
    ASPECT_PROFILES.find((p) => aspect >= p.minAspect) ??
    ASPECT_PROFILES[ASPECT_PROFILES.length - 1]
  );
}

export interface BoardFit {
  /** Khoảng cách camera ở zoom 1 */
  distance: number;
  /** Tâm nhìn (đã căn bbox bàn vào giữa khung) */
  target: THREE.Vector3;
  elevationDeg: number;
  /** Tỉ lệ chiều cao bàn bị cắt ở zoom 1 (0 = thấy trọn) */
  cropFrac: number;
  /** Có thể dịch tâm nhìn dọc theo hướng "lên màn hình" tối đa bao nhiêu (đơn vị thế giới) */
  allowUp: number;
}

/** Vectơ đơn vị trên mặt đất: phải màn hình / hướng ra xa camera */
export function groundAxes(azimuthDeg: number) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  return {
    right: new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)),
    forward: new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az)),
  };
}

const _cam = new THREE.PerspectiveCamera();
const _v = new THREE.Vector3();

function placeCamera(
  target: THREE.Vector3,
  distance: number,
  elevationDeg: number,
  aspect: number,
  cfg: BoardCameraConfig,
) {
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const az = THREE.MathUtils.degToRad(cfg.azimuthDeg);
  _cam.fov = cfg.fov;
  _cam.near = cfg.near;
  _cam.far = cfg.far;
  _cam.aspect = aspect;
  _cam.position.set(
    target.x + Math.sin(az) * Math.cos(el) * distance,
    target.y + Math.sin(el) * distance,
    target.z + Math.cos(az) * Math.cos(el) * distance,
  );
  _cam.up.set(0, 1, 0);
  _cam.lookAt(target);
  _cam.updateProjectionMatrix();
  _cam.updateMatrixWorld(true);
}

/** Chiếu 8 đỉnh hộp bao quanh bàn -> bbox trong toạ độ NDC */
function projectBox(cfg: BoardCameraConfig) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const x of [-cfg.boxHalf, cfg.boxHalf])
    for (const y of [cfg.boxMinY, cfg.boxMaxY])
      for (const z of [-cfg.boxHalf, cfg.boxHalf]) {
        _v.set(x, y, z).project(_cam);
        minX = Math.min(minX, _v.x);
        maxX = Math.max(maxX, _v.x);
        minY = Math.min(minY, _v.y);
        maxY = Math.max(maxY, _v.y);
      }
  return { minX, maxX, minY, maxY };
}

/** Tính camera vừa khít bàn cờ theo kích thước khung, chế độ hiển thị và hồ sơ tỉ lệ */
export function fitBoard(
  width: number,
  height: number,
  mode: BoardFitMode,
  cfg: BoardCameraConfig = BOARD_CAMERA,
): BoardFit {
  const aspect = width / height;
  const profile = profileForAspect(aspect);
  // Tỉ lệ thấp (máy tính bảng / màn dọc) luôn "vừa khung"
  const eff: BoardFitMode = profile.mode === "contain" ? "contain" : mode;
  const el = profile.elevationDeg;
  const target = new THREE.Vector3(0, 0, 0);
  let d = 120;

  // 2 lượt: ước lượng tuyến tính rồi tinh chỉnh (phép chiếu gần như tuyến tính vì FOV nhỏ)
  for (let pass = 0; pass < 3; pass++) {
    placeCamera(target, d, el, aspect, cfg);
    const bb = projectBox(cfg);
    const hx = (bb.maxX - bb.minX) / 2;
    const hy = (bb.maxY - bb.minY) / 2;
    const dX = (d * hx) / cfg.fillRatio;
    const dContain = Math.max(dX, (d * hy) / cfg.fillRatio);
    const dFill = Math.max(dX, d * hy * (1 - profile.maxCrop));
    const next = eff === "contain" ? dContain : dFill;
    // Căn bbox vào giữa khung
    const cx = (bb.maxX + bb.minX) / 2;
    const cy = (bb.maxY + bb.minY) / 2;
    const half = d * Math.tan(THREE.MathUtils.degToRad(cfg.fov) / 2);
    const camRight = _v.set(1, 0, 0).applyQuaternion(_cam.quaternion).clone();
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(_cam.quaternion);
    target.addScaledVector(camRight, cx * half * aspect);
    target.addScaledVector(camUp, cy * half);
    d = next;
  }
  placeCamera(target, d, el, aspect, cfg);
  const bb = projectBox(cfg);
  const hy = (bb.maxY - bb.minY) / 2;
  const crop = hy > 1 ? (hy - 1) / hy : 0;
  const halfH = d * Math.tan(THREE.MathUtils.degToRad(cfg.fov) / 2);
  const allowUp =
    hy > 1 ? ((hy - 1) * halfH) / Math.sin(THREE.MathUtils.degToRad(el)) : 0;
  return { distance: d, target, elevationDeg: el, cropFrac: crop, allowUp };
}

/** Vị trí camera từ tâm nhìn / khoảng cách / góc nâng */
export function cameraPosition(
  target: THREE.Vector3,
  distance: number,
  elevationDeg: number,
  azimuthDeg: number,
) {
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(
    target.x + Math.sin(az) * Math.cos(el) * distance,
    target.y + Math.sin(el) * distance,
    target.z + Math.cos(az) * Math.cos(el) * distance,
  );
}
