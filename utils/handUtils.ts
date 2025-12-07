
import { HandPosePrediction } from "../types";

// 將 handPose 的 hand 物件轉成「已正規化的一維向量」
// hand: 單隻手的資料（hands[0]）
// 回傳: [x1, y1, x2, y2, ..., xN, yN]，已平移/縮放/旋轉
export function getNormalizedHandVector(hand: HandPosePrediction): number[] {
  const keypoints = hand.keypoints;
  if (!keypoints || keypoints.length === 0) return [];

  // 1. 取得手腕 (wrist) 當中心點
  //   - ml5 handPose 基本上是基於 MediaPipe Hands，index 0 為 wrist
  //   - 如果有 name 欄位，也可以用 name === "wrist"
  let wrist = keypoints[0];
  const wristX = wrist.x;
  const wristY = wrist.y;

  // 2. 先做「平移」：以 wrist 為原點
  const translated = keypoints.map((kp) => {
    return {
      x: kp.x - wristX,
      y: kp.y - wristY,
    };
  });

  // 3. 計算「尺度」：用所有點離原點的最大距離來縮放（避免手大小/遠近差異）
  let maxDist = 0;
  for (let p of translated) {
    const d = Math.hypot(p.x, p.y); // sqrt(x^2 + y^2)
    if (d > maxDist) maxDist = d;
  }
  // 避免除以 0
  if (maxDist < 1e-6) maxDist = 1e-6;

  const scaled = translated.map((p) => {
    return {
      x: p.x / maxDist,
      y: p.y / maxDist,
    };
  });

  // 4. 旋轉校正：
  //    讓「手掌方向」對齊固定軸向（這裡用 wrist -> middle finger MCP）
  //    MediaPipe index 0=wrist, 9=middle_finger_mcp
  let palmRef = scaled[9] || scaled[0]; // 如果 9 不在，就退回用 wrist 自己（等於不旋轉）
  let angle = Math.atan2(palmRef.y, palmRef.x); // 目前向量角度

  // 我們希望這個向量對齊「x 軸正方向」，所以整個手旋轉 -angle
  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);

  const rotated = scaled.map((p) => {
    return {
      x: p.x * cosA - p.y * sinA,
      y: p.x * sinA + p.y * cosA,
    };
  });

  // 5. 展平成一維陣列
  const flat = [];
  for (let p of rotated) {
    flat.push(p.x);
    flat.push(p.y);
  }
  return flat;
}
