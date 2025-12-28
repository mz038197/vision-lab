import { FaceMeshPrediction, FaceMeshKeypoint } from "../types";

/**
 * FaceMesh Feature Extraction Utilities
 * 
 * 提供兩種臉部特徵提取方法：
 * 1. Distance Features (25 維) - 表情辨識推薦
 * 2. Pose Vector (3 維) - 頭部方向偵測
 */

/* ======================
 * Helper Functions
 * ====================== */

function extractKeypointsFromFace(face: FaceMeshPrediction, numPoints: number): FaceMeshKeypoint[] | null {
  if (!face || !Array.isArray(face.keypoints)) return null;
  if (face.keypoints.length < numPoints) return null;

  // Keep only first 468 points
  return face.keypoints.slice(0, numPoints).map((kp) => ({
    x: kp?.x,
    y: kp?.y,
    z: kp?.z ?? 0,
  }));
}

function isValidPoint(p: FaceMeshKeypoint | undefined): p is FaceMeshKeypoint {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function safeNumber(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/* ======================
 * Main Export Functions
 * ====================== */

/**
 * 基於距離的特徵（旋轉不變版本）
 * 
 * 返回 25 個標準化的距離/位置特徵
 * 
 * 優點：
 * - Roll 旋轉不變（先校正再計算）
 * - 尺度不變（除以眼距）
 * - 特徵維度低（25 維，訓練快）
 * - 語義清晰（每個特徵都有明確含義）
 * 
 * 適用於：表情辨識（Happy, Sad, Angry, Surprised, Neutral 等）
 * 
 * @param face - FaceMesh 預測結果（包含 468 個關鍵點）
 * @returns 25 個標準化特徵值的陣列
 */
export function getFaceDistanceFeatures(face: FaceMeshPrediction): number[] {
  const keypoints = extractKeypointsFromFace(face, 468);
  if (!keypoints) return new Array(25).fill(0);

  const leftEye = keypoints[33];
  const rightEye = keypoints[263];
  
  if (!isValidPoint(leftEye) || !isValidPoint(rightEye)) {
    return new Array(25).fill(0);
  }

  // ========================================
  // Step 1: 旋轉對齊（使眼睛連線水平）
  // ========================================
  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const eyeDist = Math.hypot(eyeDx, eyeDy);
  
  if (eyeDist < 1e-6) return new Array(25).fill(0);

  // 旋轉角度
  const roll = Math.atan2(eyeDy, eyeDx);
  const cosA = Math.cos(-roll);
  const sinA = Math.sin(-roll);

  // 中心點（兩眼中點）
  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2;

  // 旋轉並中心化所有點
  const aligned = keypoints.map(p => {
    const x = p.x - centerX;
    const y = p.y - centerY;
    return {
      x: x * cosA - y * sinA,
      y: x * sinA + y * cosA,
      z: p.z || 0
    };
  });

  // ========================================
  // Step 2: 計算標準化距離特徵
  // ========================================
  const features: number[] = [];

  // 輔助函數：計算兩點間的標準化距離
  const dist = (idx1: number, idx2: number) => {
    const p1 = aligned[idx1];
    const p2 = aligned[idx2];
    if (!p1 || !p2) return 0;
    return Math.hypot(p2.x - p1.x, p2.y - p1.y) / eyeDist;
  };

  // 輔助函數：計算點的標準化 Y 坐標（垂直位置）
  const normY = (idx: number) => {
    const p = aligned[idx];
    return p ? p.y / eyeDist : 0;
  };

  // 輔助函數：計算點的標準化 X 坐標（水平位置）
  const normX = (idx: number) => {
    const p = aligned[idx];
    return p ? p.x / eyeDist : 0;
  };

  // ========================================
  // 特徵 1-4: 眼睛特徵
  // ========================================
  
  // 1. 左眼高度（開合度）
  features.push(dist(159, 145)); // 左眼上眼瞼到下眼瞼
  
  // 2. 右眼高度（開合度）
  features.push(dist(386, 374)); // 右眼上眼瞼到下眼瞼
  
  // 3. 左眼寬度
  features.push(dist(33, 133)); // 左眼內角到外角
  
  // 4. 右眼寬度
  features.push(dist(362, 263)); // 右眼內角到外角

  // ========================================
  // 特徵 5-8: 眉毛特徵
  // ========================================
  
  // 5. 左眉毛高度（相對於左眼）
  features.push(Math.abs(normY(70) - normY(159)));
  
  // 6. 右眉毛高度（相對於右眼）
  features.push(Math.abs(normY(300) - normY(386)));
  
  // 7-8. 眉毛寬度
  features.push(dist(70, 46)); // 左眉
  features.push(dist(300, 276)); // 右眉

  // ========================================
  // 特徵 9-16: 嘴巴特徵（表情關鍵！）
  // ========================================
  
  // 9. 嘴巴寬度
  features.push(dist(61, 291)); // 左嘴角到右嘴角
  
  // 10. 嘴巴外圍高度
  features.push(dist(0, 17)); // 上唇到下唇
  
  // 11. 嘴巴內部高度（張嘴程度）
  features.push(dist(13, 14)); // 上牙齦到下牙齦
  
  // 12-13. 嘴角高度（微笑檢測）
  features.push(normY(61)); // 左嘴角的 Y 位置
  features.push(normY(291)); // 右嘴角的 Y 位置
  
  // 14-15. 上下唇中點位置
  features.push(normY(0)); // 上唇中點
  features.push(normY(17)); // 下唇中點
  
  // 16. 嘴巴中心到鼻尖距離
  features.push(dist(1, 13)); // 鼻尖到上唇

  // ========================================
  // 特徵 17-20: 鼻子特徵
  // ========================================
  
  // 17. 鼻子高度
  features.push(dist(168, 6)); // 鼻根到鼻尖
  
  // 18. 鼻孔寬度
  features.push(dist(94, 326)); // 左鼻孔到右鼻孔
  
  // 19-20. 鼻尖相對位置
  features.push(normX(1)); // 鼻尖 X（檢測側臉）
  features.push(normY(1)); // 鼻尖 Y

  // ========================================
  // 特徵 21-25: 臉部輪廓和比例
  // ========================================
  
  // 21. 臉部高度（額頭到下巴）
  features.push(dist(10, 152));
  
  // 22. 臉部寬度（左臉到右臉）
  features.push(dist(234, 454));
  
  // 23. 左臉頰到眼睛距離
  features.push(dist(234, 33));
  
  // 24. 右臉頰到眼睛距離
  features.push(dist(454, 263));
  
  // 25. 下巴到嘴巴距離
  features.push(dist(152, 17));

  return features.map(safeNumber);
}

/**
 * 頭部姿態向量提取
 * 
 * 返回 [yawNorm, pitchNorm, rollNorm] 標準化到 [-1, 1] 範圍
 * 
 * 特徵說明：
 * - yaw: 左右轉頭（-1 = 向左轉, +1 = 向右轉）
 * - pitch: 上下仰頭（-1 = 低頭, +1 = 抬頭）
 * - roll: 左右歪頭（-1 = 向左歪, +1 = 向右歪）
 * 
 * 適用於：頭部方向偵測（Looking Left, Looking Right, Looking Up, Looking Down 等）
 * 
 * @param face - FaceMesh 預測結果（包含 468 個關鍵點）
 * @returns [yaw, pitch, roll] 三個標準化值的陣列
 */
export function getNormalizedFacePoseVector(face: FaceMeshPrediction): number[] {
  const keypoints = extractKeypointsFromFace(face, 468);
  if (!keypoints) return [0, 0, 0];

  // 關鍵點索引
  const leftEye = keypoints[33];
  const rightEye = keypoints[263];
  const nose = keypoints[1];
  const chin = keypoints[152];

  if (![leftEye, rightEye, nose, chin].every(isValidPoint)) {
    return [0, 0, 0];
  }

  // 眼距計算
  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const eyeDist = Math.hypot(eyeDx, eyeDy);
  if (!Number.isFinite(eyeDist) || eyeDist < 1e-6) {
    return [0, 0, 0];
  }

  // Roll: 眼睛連線角度
  const rollRaw = Math.atan2(eyeDy, eyeDx);

  // Yaw: 左右不對稱性（鼻子相對於眼睛的位置）
  const yawRaw = Math.abs(nose.x - leftEye.x) - Math.abs(rightEye.x - nose.x);

  // Pitch: 鼻子在臉部高度的相對位置
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = chin.y - eyeCenterY;
  if (!Number.isFinite(faceHeight) || Math.abs(faceHeight) < 1e-6) {
    return [0, 0, 0];
  }
  const pitchRaw = (nose.y - eyeCenterY) / faceHeight;

  // 標準化到 [-1, 1]
  const yawNorm = clamp(safeNumber(yawRaw / eyeDist), -1, 1);
  const pitchNorm = clamp(safeNumber((pitchRaw - 0.5) * 2), -1, 1);
  const rollMaxRad = (45 * Math.PI) / 180; // ±45° 映射到 ±1
  const rollNorm = clamp(safeNumber(rollRaw / rollMaxRad), -1, 1);

  return [yawNorm, pitchNorm, rollNorm];
}

/**
 * 混合特徵向量提取 (Distance + Pose)
 * 
 * 結合距離特徵和姿態特徵，提供最完整的臉部資訊
 * 
 * 返回 28 個特徵：
 * - 前 25 個：距離特徵（表情資訊）
 * - 後 3 個：姿態特徵（yaw, pitch, roll）
 * 
 * 優點：
 * - 同時捕捉表情和頭部方向
 * - 最豐富的特徵表示
 * - 適合複雜場景辨識
 * 
 * 適用於：需要同時辨識表情和方向的場景
 * 例如：Happy + Looking Left, Sad + Looking Down, Surprised + Looking Right 等
 * 
 * @param face - FaceMesh 預測結果（包含 468 個關鍵點）
 * @returns 28 個標準化特徵值的陣列 [distance features (25), pose features (3)]
 */
export function getHybridFaceVector(face: FaceMeshPrediction): number[] {
  const distanceFeatures = getFaceDistanceFeatures(face);
  const poseFeatures = getNormalizedFacePoseVector(face);
  
  // 結合兩種特徵
  return [...distanceFeatures, ...poseFeatures];
}
