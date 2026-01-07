import { HandPosePrediction } from "../types";

/**
 * Hand Pose Feature Extraction Utilities
 * 
 * 提供手勢特徵正規化處理：
 * - Translation: 以手腕為中心
 * - Scale: 最大距離標準化
 * - Rotation: 中指 MCP 對齊到 X 軸
 */

/* ======================
 * Helper Functions
 * ====================== */

function safeNumber(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/* ======================
 * Main Export Function
 * ====================== */

/**
 * 手勢特徵正規化向量提取
 * 
 * 將 21 個手部關鍵點轉換為 42 維正規化特徵向量
 * 
 * 正規化步驟：
 * 1. Translation: 以手腕 (index 0) 為中心平移
 * 2. Scale: 使用最大距離標準化
 * 3. Rotation: 將中指 MCP (index 9) 對齊到 X 軸
 * 
 * 優點：
 * - 位置不變（Translation）
 * - 尺度不變（Scale）
 * - 旋轉不變（Rotation）
 * - 穩定的特徵表示
 * 
 * 適用於：手勢辨識（Rock, Paper, Scissors, One, Two, Three 等）
 * 
 * @param hand - HandPose 預測結果（包含 21 個關鍵點）
 * @returns 42 個標準化特徵值的陣列 [x1, y1, x2, y2, ..., x21, y21]
 */
export function getNormalizedHandVector(hand: HandPosePrediction): number[] {
  const keypoints = hand?.keypoints;
  const NUM_POINTS = 21;
  // 移除手腕的 x,y (總是 0,0)，所以是 20 個點 * 2 = 40 維
  const VECTOR_SIZE = (NUM_POINTS - 1) * 2;

  // ----------------------------
  // 0. 安全檢查
  // ----------------------------
  if (!keypoints || keypoints.length !== NUM_POINTS) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  // ----------------------------
  // 1. Translation：以 wrist 為中心
  // ----------------------------
  const wrist = keypoints[0];
  if (!isFinite(wrist.x) || !isFinite(wrist.y)) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  const translated = keypoints.map(kp => ({
    x: safeNumber(kp.x - wrist.x),
    y: safeNumber(kp.y - wrist.y),
  }));

  // ----------------------------
  // 2. Scale：最大距離 normalization
  // ----------------------------
  let maxDist = 0;
  for (const p of translated) {
    const d = Math.hypot(p.x, p.y);
    if (d > maxDist) maxDist = d;
  }

  if (!isFinite(maxDist) || maxDist < 1e-6) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  const scaled = translated.map(p => ({
    x: p.x / maxDist,
    y: p.y / maxDist,
  }));

  // ----------------------------
  // 3. Rotation：中指 MCP → x 軸
  // ----------------------------
  const middleMCP = scaled[9] ?? { x: 1, y: 0 };
  const angle = Math.atan2(middleMCP.y, middleMCP.x);

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);

  const rotated = scaled.map(p => ({
    x: safeNumber(p.x * cosA - p.y * sinA),
    y: safeNumber(p.x * sinA + p.y * cosA),
  }));

  // ----------------------------
  // 4. Flatten - 跳過手腕 (index 0)，因為它總是 (0, 0)
  // ----------------------------
  const vector: number[] = [];
  for (let i = 1; i < rotated.length; i++) { // 從 index 1 開始，跳過手腕
    vector.push(safeNumber(rotated[i].x), safeNumber(rotated[i].y));
  }

  return vector.length === VECTOR_SIZE
    ? vector
    : new Array(VECTOR_SIZE).fill(0);
}

/**
 * @deprecated 使用 getNormalizedHandVector 代替
 * 保留此函數以向後兼容
 */
export function flattenHandData(hand: HandPosePrediction): number[] {
  return getNormalizedHandVector(hand);
}
