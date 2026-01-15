import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';
import { ObjectDetectionResult } from '../types';

interface ObjectDetectorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  onDetections?: (detections: ObjectDetectionResult[]) => void;
}

const DEFAULT_COCO_LABELS = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train',
  'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign',
  'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep',
  'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella',
  'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
  'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard',
  'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork',
  'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv',
  'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave',
  'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase',
  'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

const ObjectDetector: React.FC<ObjectDetectorProps> = ({ videoRef, isActive, onDetections }) => {
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [modelName, setModelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<ObjectDetectionResult[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.25);
  const [iouThreshold, setIouThreshold] = useState(0.45);
  const [labelsText, setLabelsText] = useState(DEFAULT_COCO_LABELS.join('\n'));
  const [inputSize, setInputSize] = useState({ width: 640, height: 640 });
  const [inputLayout, setInputLayout] = useState<'NCHW' | 'NHWC'>('NCHW');
  const [useLetterbox, setUseLetterbox] = useState(true);
  const [inputName, setInputName] = useState('');
  const [outputName, setOutputName] = useState('');

  const detectionTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDetectingRef = useRef(false);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const preprocessMetaRef = useRef({
    scale: 1,
    padX: 0,
    padY: 0,
    inputWidth: 640,
    inputHeight: 640,
    videoWidth: 1,
    videoHeight: 1
  });

  const labels = useMemo(() => {
    const parsed = labelsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : DEFAULT_COCO_LABELS;
  }, [labelsText]);

  const updateWasmConfig = () => {
    if (!ort.env?.wasm) return;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  };

  const resolveInputConfig = (session: ort.InferenceSession) => {
    const name = session.inputNames[0];
    const output = session.outputNames[0];
    const metadata = session.inputMetadata?.[name];
    const dims = metadata?.dimensions ?? [];
    const normalized = dims.map((value) =>
      typeof value === 'number' && value > 0 ? value : undefined
    );

    let width = 640;
    let height = 640;
    let layout: 'NCHW' | 'NHWC' = 'NCHW';

    if (normalized.length === 4) {
      const [n, d1, d2, d3] = normalized;
      if (d1 === 3 && d2 && d3) {
        layout = 'NCHW';
        height = d2;
        width = d3;
      } else if (d3 === 3 && d1 && d2) {
        layout = 'NHWC';
        height = d1;
        width = d2;
      } else if (d2 && d3) {
        layout = 'NCHW';
        height = d2;
        width = d3;
      }
    }

    setInputName(name);
    setOutputName(output);
    setInputSize({ width, height });
    setInputLayout(layout);
  };

  const stopDetection = () => {
    if (detectionTimerRef.current) {
      clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    isDetectingRef.current = false;
    setIsDetecting(false);
    setDetections([]);
    if (onDetections) {
      onDetections([]);
    }
  };

  const handleModelFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      updateWasmConfig();
      const buffer = await file.arrayBuffer();
      const newSession = await ort.InferenceSession.create(buffer, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all'
      });

      sessionRef.current = newSession;
      setSession(newSession);
      setModelName(file.name);
      resolveInputConfig(newSession);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Failed to load ONNX model:', err);
      setError(`Model load failed: ${err.message ?? 'Unknown error'}`);
      setIsLoading(false);
      sessionRef.current = null;
      setSession(null);
      setModelName('');
    }
  };

  const preprocessImage = (video: HTMLVideoElement) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    canvas.width = inputSize.width;
    canvas.height = inputSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create canvas context');
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    let scale = 1;
    let padX = 0;
    let padY = 0;

    if (useLetterbox && videoWidth > 0 && videoHeight > 0) {
      const ratio = Math.min(inputSize.width / videoWidth, inputSize.height / videoHeight);
      const newWidth = Math.round(videoWidth * ratio);
      const newHeight = Math.round(videoHeight * ratio);
      padX = Math.floor((inputSize.width - newWidth) / 2);
      padY = Math.floor((inputSize.height - newHeight) / 2);
      scale = ratio;

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, inputSize.width, inputSize.height);
      ctx.drawImage(video, padX, padY, newWidth, newHeight);
    } else {
      ctx.drawImage(video, 0, 0, inputSize.width, inputSize.height);
      scale = inputSize.width / (videoWidth || inputSize.width);
      padX = 0;
      padY = 0;
    }

    preprocessMetaRef.current = {
      scale,
      padX,
      padY,
      inputWidth: inputSize.width,
      inputHeight: inputSize.height,
      videoWidth: videoWidth || inputSize.width,
      videoHeight: videoHeight || inputSize.height
    };
    const imageData = ctx.getImageData(0, 0, inputSize.width, inputSize.height);
    const pixels = imageData.data;

    if (inputLayout === 'NHWC') {
      const data = new Float32Array(inputSize.width * inputSize.height * 3);
      for (let i = 0; i < inputSize.width * inputSize.height; i++) {
        data[i * 3] = pixels[i * 4] / 255;
        data[i * 3 + 1] = pixels[i * 4 + 1] / 255;
        data[i * 3 + 2] = pixels[i * 4 + 2] / 255;
      }
      return new ort.Tensor('float32', data, [1, inputSize.height, inputSize.width, 3]);
    }

    const data = new Float32Array(1 * 3 * inputSize.height * inputSize.width);
    const channelSize = inputSize.width * inputSize.height;
    for (let i = 0; i < channelSize; i++) {
      data[i] = pixels[i * 4] / 255;
      data[channelSize + i] = pixels[i * 4 + 1] / 255;
      data[channelSize * 2 + i] = pixels[i * 4 + 2] / 255;
    }
    return new ort.Tensor('float32', data, [1, 3, inputSize.height, inputSize.width]);
  };

  const calculateIOU = (a: number[], b: number[]) => {
    const [ax1, ay1, ax2, ay2] = a;
    const [bx1, by1, bx2, by2] = b;

    const interX1 = Math.max(ax1, bx1);
    const interY1 = Math.max(ay1, by1);
    const interX2 = Math.min(ax2, bx2);
    const interY2 = Math.min(ay2, by2);

    const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
    const boxAArea = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
    const boxBArea = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
    const union = boxAArea + boxBArea - interArea;

    return union <= 0 ? 0 : interArea / union;
  };

  const nonMaxSuppression = (boxes: number[][], scores: number[], threshold: number) => {
    const sorted = scores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.index);

    const selected: number[] = [];
    while (sorted.length > 0) {
      const current = sorted.shift();
      if (current === undefined) break;
      selected.push(current);
      const remaining: number[] = [];
      for (const idx of sorted) {
        const iou = calculateIOU(boxes[current], boxes[idx]);
        if (iou < threshold) {
          remaining.push(idx);
        }
      }
      sorted.length = 0;
      sorted.push(...remaining);
    }
    return selected;
  };

  const parseYoloOutput = (
    output: ort.Tensor,
    videoWidth: number,
    videoHeight: number
  ): ObjectDetectionResult[] => {
    const data = output.data as Float32Array;
    const dims = output.dims ?? [];
    
    console.log('📊 Model output shape:', dims);
    
    // 特殊處理：已經做好 NMS 的輸出格式 [1, N, 6]
    // 格式: [x1, y1, x2, y2, confidence, class_id]
    if (dims.length === 3 && dims[2] === 6) {
      const numDetections = dims[1] ?? 0;
      const detections: ObjectDetectionResult[] = [];
      const meta = preprocessMetaRef.current;
      
      console.log(`🔍 Detected NMS output format: [${dims[0]}, ${dims[1]}, ${dims[2]}]`);
      console.log(`📋 Available labels: ${labels.length} classes`);
      
      let validCount = 0;
      let skippedLowConf = 0;
      let skippedInvalidClass = 0;
      
      for (let i = 0; i < numDetections; i++) {
        const offset = i * 6;
        const x1 = data[offset];
        const y1 = data[offset + 1];
        const x2 = data[offset + 2];
        const y2 = data[offset + 3];
        const confidence = data[offset + 4];
        const classId = Math.round(data[offset + 5]);
        
        // Debug: 顯示前 3 個檢測的原始數據
        if (i < 3) {
          console.log(`📦 Detection ${i}: x1=${x1.toFixed(1)}, y1=${y1.toFixed(1)}, x2=${x2.toFixed(1)}, y2=${y2.toFixed(1)}, conf=${confidence.toFixed(3)}, class=${classId}`);
        }
        
        // 過濾低信心度
        if (confidence < confidenceThreshold) {
          skippedLowConf++;
          continue;
        }
        
        // 過濾無效 class ID
        if (classId < 0 || classId >= labels.length) {
          skippedInvalidClass++;
          if (i < 5) {
            console.warn(`⚠️ Invalid class ID ${classId} (labels count: ${labels.length})`);
          }
          continue;
        }
        
        validCount++;
        
        // 座標轉換：從模型輸出空間轉回原始視頻空間
        let videoX1, videoY1, videoX2, videoY2;
        
        if (useLetterbox) {
          // Letterbox 模式：扣除 padding 並縮放回原始尺寸
          videoX1 = (x1 - meta.padX) / meta.scale;
          videoY1 = (y1 - meta.padY) / meta.scale;
          videoX2 = (x2 - meta.padX) / meta.scale;
          videoY2 = (y2 - meta.padY) / meta.scale;
        } else {
          // 直接縮放模式
          const scaleX = meta.videoWidth / meta.inputWidth;
          const scaleY = meta.videoHeight / meta.inputHeight;
          videoX1 = x1 * scaleX;
          videoY1 = y1 * scaleY;
          videoX2 = x2 * scaleX;
          videoY2 = y2 * scaleY;
        }
        
        // 限制在視頻範圍內
        videoX1 = Math.max(0, Math.min(meta.videoWidth, videoX1));
        videoY1 = Math.max(0, Math.min(meta.videoHeight, videoY1));
        videoX2 = Math.max(0, Math.min(meta.videoWidth, videoX2));
        videoY2 = Math.max(0, Math.min(meta.videoHeight, videoY2));
        
        const width = videoX2 - videoX1;
        const height = videoY2 - videoY1;
        
        if (width > 0 && height > 0) {
          detections.push({
            bbox: {
              x: videoX1,
              y: videoY1,
              width,
              height
            },
            label: labels[classId] || `Class ${classId}`,
            classId,
            confidence
          });
        }
      }
      
      console.log(`✅ Parsed ${detections.length} valid detections (skipped: ${skippedLowConf} low conf, ${skippedInvalidClass} invalid class)`);
      
      if (detections.length > 0) {
        console.log(`🎯 Sample detection:`, detections[0]);
      }
      
      return detections;
    }
    
    // 原有的 YOLO 格式處理邏輯
    let numBoxes = 0;
    let numAttrs = 0;
    let layout: 'CHANNELS_FIRST' | 'CHANNELS_LAST' = 'CHANNELS_LAST';

    if (dims.length === 3) {
      const d1 = dims[1] ?? 0;
      const d2 = dims[2] ?? 0;
      if (d1 > d2) {
        numAttrs = d1;
        numBoxes = d2;
        layout = 'CHANNELS_FIRST';
      } else {
        numBoxes = d1;
        numAttrs = d2;
        layout = 'CHANNELS_LAST';
      }
    } else if (dims.length === 2) {
      numBoxes = dims[0] ?? 0;
      numAttrs = dims[1] ?? 0;
      layout = 'CHANNELS_LAST';
    }

    if (!numBoxes || !numAttrs) {
      if (data.length % 85 === 0) {
        numAttrs = 85;
      } else if (data.length % 84 === 0) {
        numAttrs = 84;
      } else if (data.length % 6 === 0) {
        numAttrs = 6;
      } else {
        return [];
      }
      numBoxes = data.length / numAttrs;
      layout = 'CHANNELS_LAST';
    }

    const possibleClassesNoObj = numAttrs - 4;
    const possibleClassesWithObj = numAttrs - 5;
    const useObjectness = possibleClassesWithObj > 0 && (
      possibleClassesWithObj === labels.length || possibleClassesNoObj !== labels.length
    );
    const classStart = useObjectness ? 5 : 4;
    const numClasses = useObjectness ? possibleClassesWithObj : possibleClassesNoObj;

    const boxes: number[][] = [];
    const scores: number[] = [];
    const classIds: number[] = [];
    let maxCoord = 0;
    let sampleIsXyxy = false;

    for (let i = 0; i < numBoxes; i++) {
      const getValue = (attrIndex: number) => {
        if (layout === 'CHANNELS_FIRST') {
          return data[attrIndex * numBoxes + i];
        }
        return data[i * numAttrs + attrIndex];
      };

      const v0 = getValue(0);
      const v1 = getValue(1);
      const v2 = getValue(2);
      const v3 = getValue(3);
      maxCoord = Math.max(maxCoord, v0, v1, v2, v3);

      let bestClass = 0;
      let bestScore = 0;
      for (let c = 0; c < numClasses; c++) {
        const score = getValue(classStart + c);
        if (score > bestScore) {
          bestScore = score;
          bestClass = c;
        }
      }

      const objectness = useObjectness ? getValue(4) : 1;
      const confidence = bestScore * objectness;
      if (confidence < confidenceThreshold) {
        continue;
      }

      const isLikelyXyxy = numAttrs === 6 && v2 > v0 && v3 > v1;
      sampleIsXyxy = sampleIsXyxy || isLikelyXyxy;

      const cx = v0;
      const cy = v1;
      const w = v2;
      const h = v3;

      const x1 = isLikelyXyxy ? v0 : cx - w / 2;
      const y1 = isLikelyXyxy ? v1 : cy - h / 2;
      const x2 = isLikelyXyxy ? v2 : cx + w / 2;
      const y2 = isLikelyXyxy ? v3 : cy + h / 2;

      boxes.push([x1, y1, x2, y2]);
      scores.push(confidence);
      classIds.push(bestClass);
    }

    if (boxes.length === 0) {
      return [];
    }

    const normalized = maxCoord <= 1.5;
    const scaleX = normalized ? inputSize.width : 1;
    const scaleY = normalized ? inputSize.height : 1;
    const meta = preprocessMetaRef.current;
    const ratioX = meta.inputWidth > 0 ? meta.videoWidth / meta.inputWidth : videoWidth / inputSize.width;
    const ratioY = meta.inputHeight > 0 ? meta.videoHeight / meta.inputHeight : videoHeight / inputSize.height;

    const selected = nonMaxSuppression(boxes, scores, iouThreshold);
    return selected.map((index) => {
      const [x1, y1, x2, y2] = boxes[index];
      let scaledX1 = x1 * scaleX;
      let scaledY1 = y1 * scaleY;
      let scaledX2 = x2 * scaleX;
      let scaledY2 = y2 * scaleY;

      if (useLetterbox) {
        scaledX1 = (scaledX1 - meta.padX) / meta.scale;
        scaledY1 = (scaledY1 - meta.padY) / meta.scale;
        scaledX2 = (scaledX2 - meta.padX) / meta.scale;
        scaledY2 = (scaledY2 - meta.padY) / meta.scale;
      } else {
        scaledX1 *= ratioX;
        scaledY1 *= ratioY;
        scaledX2 *= ratioX;
        scaledY2 *= ratioY;
      }
      const classId = classIds[index];
      const label = labels[classId] ?? `class_${classId}`;

      return {
        bbox: {
          x: Math.max(0, Math.min(meta.videoWidth, scaledX1)),
          y: Math.max(0, Math.min(meta.videoHeight, scaledY1)),
          width: Math.max(0, Math.min(meta.videoWidth, scaledX2) - Math.max(0, Math.min(meta.videoWidth, scaledX1))),
          height: Math.max(0, Math.min(meta.videoHeight, scaledY2) - Math.max(0, Math.min(meta.videoHeight, scaledY1)))
        },
        classId,
        label,
        confidence: scores[index]
      };
    });
  };

  const runDetection = async () => {
    if (!isDetectingRef.current || !sessionRef.current || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) {
      detectionTimerRef.current = window.setTimeout(runDetection, 200);
      return;
    }

    try {
      const inputTensor = preprocessImage(video);
      const feeds: Record<string, ort.Tensor> = {};
      feeds[inputName] = inputTensor;

      const results = await sessionRef.current.run(feeds);
      const output = results[outputName] ?? results[sessionRef.current.outputNames[0]];
      if (!output) {
        throw new Error('Model output not found');
      }

      const newDetections = parseYoloOutput(output, video.videoWidth, video.videoHeight);
      setDetections(newDetections);
      if (onDetections) {
        onDetections(newDetections);
      }
    } catch (err) {
      console.error('Detection error:', err);
      setError('Detection failed. Please check the model format.');
      stopDetection();
      return;
    }

    detectionTimerRef.current = window.setTimeout(runDetection, 150);
  };

  const startDetection = () => {
    if (!sessionRef.current || isDetectingRef.current || !isActive) return;
    if (!inputName || !outputName) {
      setError('Model IO not ready yet. Please reload the model.');
      return;
    }
    isDetectingRef.current = true;
    setIsDetecting(true);
    runDetection();
  };

  const handleLabelsFile = async (file: File) => {
    const text = await file.text();
    setLabelsText(text);
  };

  useEffect(() => {
    if (!isActive) {
      stopDetection();
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      stopDetection();
      sessionRef.current = null;
    };
  }, []);

  return (
    <div className="w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex-none">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">Object Detection (ONNX)</h3>
          {session && (
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">Model Loaded</span>
          )}
          {isLoading && (
            <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded animate-pulse">Loading...</span>
          )}
        </div>
        {modelName && (
          <p className="text-xs text-gray-400 truncate">Model: {modelName}</p>
        )}
      </div>

      <div className="overflow-y-auto p-4 space-y-4 flex-none max-h-[400px]">
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Model File (.onnx)</label>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".onnx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleModelFile(file);
                }
                e.currentTarget.value = '';
              }}
              className="hidden"
              id="onnx-model-input"
            />
            <label
              htmlFor="onnx-model-input"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-1 cursor-pointer"
            >
              Upload Model
            </label>
            <button
              onClick={() => setLabelsText(DEFAULT_COCO_LABELS.join('\n'))}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
            >
              Reset Labels
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Supports YOLO-style ONNX outputs. Input size: {inputSize.width}×{inputSize.height} ({inputLayout})
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Labels (one per line)</label>
          <textarea
            value={labelsText}
            onChange={(e) => setLabelsText(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
          />
          <input
            type="file"
            accept=".txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleLabelsFile(file);
              }
              e.currentTarget.value = '';
            }}
            className="hidden"
            id="labels-file-input"
          />
          <label
            htmlFor="labels-file-input"
            className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 cursor-pointer"
          >
            Upload labels .txt
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Confidence</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">NMS IoU</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={iouThreshold}
              onChange={(e) => setIouThreshold(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useLetterbox}
              onChange={(e) => setUseLetterbox(e.target.checked)}
              className="accent-indigo-500"
            />
            Letterbox resize (recommended)
          </label>
          <span>Output format: {inputLayout} @ {inputSize.width}×{inputSize.height}</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Detections</label>
          {session && detections.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
              {isDetecting ? 'Scanning for objects...' : 'Start detection to see results'}
            </div>
          )}
          {detections.length > 0 && (
            <div className="space-y-2">
              {detections.slice(0, 10).map((det, index) => (
                <div key={`${det.label}-${index}`} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{det.label}</span>
                    <span className="text-indigo-400 text-xs font-semibold">
                      {(det.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400"
                      style={{ width: `${det.confidence * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-800 space-y-2 flex-none">
        <div className="flex gap-2">
          <button
            onClick={startDetection}
            disabled={!session || isDetecting || !isActive || isLoading}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
          >
            {isDetecting ? 'Detecting...' : 'Start'}
          </button>
          <button
            onClick={stopDetection}
            disabled={!isDetecting}
            className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObjectDetector;
