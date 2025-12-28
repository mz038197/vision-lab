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

  // ----------------------------
  // 0. 安全檢查
  // ----------------------------
  if (!keypoints || keypoints.length < NUM_POINTS) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  // 過濾低信心的點
  const validKeypoints = keypoints.slice(0, NUM_POINTS).map(kp => ({
    x: kp.confidence > 0.3 ? kp.x : 0,
    y: kp.confidence > 0.3 ? kp.y : 0,
    confidence: kp.confidence
  }));

  // ----------------------------
  // 1. Translation：以髖部中點為中心
  // ----------------------------
  const leftHip = validKeypoints[11];
  const rightHip = validKeypoints[12];

  // 確保髖部關鍵點有效
  if (leftHip.confidence < 0.3 || rightHip.confidence < 0.3) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const hipCenterY = (leftHip.y + rightHip.y) / 2;

  if (!isFinite(hipCenterX) || !isFinite(hipCenterY)) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  const translated = validKeypoints.map(kp => ({
    x: safeNumber(kp.x - hipCenterX),
    y: safeNumber(kp.y - hipCenterY),
    confidence: kp.confidence
  }));

  // ----------------------------
  // 2. Scale：使用肩寬標準化
  // ----------------------------
  const leftShoulder = translated[5];
  const rightShoulder = translated[6];

  // 確保肩膀關鍵點有效
  if (validKeypoints[5].confidence < 0.3 || validKeypoints[6].confidence < 0.3) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  const shoulderWidth = Math.hypot(
    rightShoulder.x - leftShoulder.x,
    rightShoulder.y - leftShoulder.y
  );

  if (!isFinite(shoulderWidth) || shoulderWidth < 1e-6) {
    return new Array(VECTOR_SIZE).fill(0);
  }

  const scaled = translated.map(p => ({
    x: p.x / shoulderWidth,
    y: p.y / shoulderWidth,
    confidence: p.confidence
  }));

  // ----------------------------
  // 3. Rotation：肩線對齊到水平
  // ----------------------------
  const shoulderDx = scaled[6].x - scaled[5].x;
  const shoulderDy = scaled[6].y - scaled[5].y;
  const angle = Math.atan2(shoulderDy, shoulderDx);

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);

  const rotated = scaled.map(p => ({
    x: safeNumber(p.x * cosA - p.y * sinA),
    y: safeNumber(p.x * sinA + p.y * cosA),
    confidence: p.confidence
  }));

  // ----------------------------
  // 4. Flatten
  // ----------------------------
  const vector: number[] = [];
  for (const p of rotated) {
    vector.push(safeNumber(p.x), safeNumber(p.y));
  }

  return vector.length === VECTOR_SIZE
    ? vector
    : new Array(VECTOR_SIZE).fill(0);
}

