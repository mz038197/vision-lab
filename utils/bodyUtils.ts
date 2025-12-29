import { BodyPosePrediction, BodyPoseKeypoint } from "../types";

/**
 * Body Pose Feature Extraction Utilities
 * 
 * 提供身體姿態特徵正規化處理：
 * - Translation: 以髖部中點為中心
 * - Scale: 肩寬標準化
 * - Rotation: 肩線對齊到水平
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
 * 身體姿態特徵正規化向量提取
 * 
 * 將 17 個身體關鍵點轉換為 34 維正規化特徵向量
 * 
 * 關鍵點索引 (COCO format):
 * 0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear
 * 5: left_shoulder, 6: right_shoulder, 7: left_elbow, 8: right_elbow
 * 9: left_wrist, 10: right_wrist, 11: left_hip, 12: right_hip
 * 13: left_knee, 14: right_knee, 15: left_ankle, 16: right_ankle
 * 
 * 正規化步驟：
 * 1. Translation: 以髖部中點 (hip center) 為中心平移
 * 2. Scale: 使用肩寬標準化
 * 3. Rotation: 將肩線對齊到水平
 * 
 * 優點：
 * - 位置不變（Translation）
 * - 尺度不變（Scale）
 * - 旋轉不變（Rotation）
 * - 穩定的特徵表示
 * 
 * 適用於：姿勢辨識（Standing, Sitting, Jumping, Arms Up, T-Pose 等）
 * 
 * @param body - BodyPose 預測結果（包含 17 個關鍵點）
 * @returns 34 個標準化特徵值的陣列 [x1, y1, x2, y2, ..., x17, y17]
 */
export function getNormalizedBodyVector(body: BodyPosePrediction): number[] {
  const keypoints = body?.keypoints;
  const NUM_POINTS = 17;
  const VECTOR_SIZE = NUM_POINTS * 2;
  const CONF_TH = 0;

  if (!keypoints || keypoints.length < NUM_POINTS) {
    return null;
  }

  // ----------------------------
  // 1. confidence 過濾（單點補 0）
  // ----------------------------
  const pts = keypoints.slice(0, NUM_POINTS).map(kp => ({
    x: kp.confidence > CONF_TH ? kp.x : 0,
    y: kp.confidence > CONF_TH ? kp.y : 0,
    c: kp.confidence
  }));

  // ----------------------------
  // 2. Translation：以髖部中心
  // ----------------------------
  const lh = pts[11];
  const rh = pts[12];

  // 若髖部雙雙無效 → 這筆資料沒意義
  if (lh.c <= CONF_TH && rh.c <= CONF_TH) {
    return null;
  }

  const cx = (lh.x + rh.x) / 2;
  const cy = (lh.y + rh.y) / 2;

  const translated = pts.map(p => ({
    x: p.x - cx,
    y: p.y - cy,
    c: p.c
  }));

  // ----------------------------
  // 3. Scale：肩寬（若肩壞 → fallback）
  // ----------------------------
  const ls = translated[5];
  const rs = translated[6];

  let scale = Math.hypot(rs.x - ls.x, rs.y - ls.y);

  // 肩膀壞掉 → 用身體高度當尺度（保命）
  if (!isFinite(scale) || scale < 1e-3) {
    const yVals = translated.map(p => Math.abs(p.y));
    scale = Math.max(...yVals);
  }

  if (!isFinite(scale) || scale < 1e-3) {
    return null;
  }

  const scaled = translated.map(p => ({
    x: p.x / scale,
    y: p.y / scale,
    c: p.c
  }));

  // ----------------------------
  // 4. Rotation：肩線對齊水平（可解釋）
  // ----------------------------
  let angle = 0;

  if (ls.c > CONF_TH && rs.c > CONF_TH) {
    angle = Math.atan2(rs.y - ls.y, rs.x - ls.x);
  }

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);

  const rotated = scaled.map(p => ({
    x: p.x * cosA - p.y * sinA,
    y: p.x * sinA + p.y * cosA,
    c: p.c
  }));

  // ----------------------------
  // 5. Flatten（保證不是全 0）
  // ----------------------------
  const vector = [];
  let energy = 0;

  for (const p of rotated) {
    vector.push(p.x, p.y);
    energy += Math.abs(p.x) + Math.abs(p.y);
  }

  // 全部太接近 0 → 當作壞資料
  if (energy < 1e-4) {
    return null;
  }

  return vector.length === VECTOR_SIZE ? vector : null;
}

