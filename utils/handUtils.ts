
import { HandPosePrediction } from "../types";

/**
 * ml5.js 官方的 flattenHandData 方式
 * 將 handPose 的 keypoints 展平成一維數組
 * hand: 單隻手的資料（hands[0]）
 * 回傳: [x1, y1, x2, y2, ..., xN, yN]
 */
export function flattenHandData(hand: HandPosePrediction): number[] {
  const keypoints = hand.keypoints;
  if (!keypoints || keypoints.length === 0) return [];

  const flat: number[] = [];
  for (const kp of keypoints) {
    flat.push(kp.x);
    flat.push(kp.y);
  }
  return flat;
}

// 保留舊名稱作為別名，以防其他地方使用
export const getNormalizedHandVector = flattenHandData;
