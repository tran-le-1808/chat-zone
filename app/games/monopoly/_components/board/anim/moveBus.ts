/**
 * Gợi ý thời lượng từng bước do logic (chủ phòng) tính sẵn, để hoạt ảnh và nhịp logic khớp nhau.
 * Máy khách không có gợi ý -> tự suy từ nhịp thực tế (xem SmoothPawn). Chỉ là hiển thị.
 */
const hints = new Map<number, number[]>();
export const setMoveHint = (playerId: number, durations: number[]) => void hints.set(playerId, durations);
export const getMoveHint = (playerId: number) => hints.get(playerId);
export const clearMoveHint = (playerId: number) => void hints.delete(playerId);
