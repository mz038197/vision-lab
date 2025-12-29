
import React, { useEffect, useState, useRef } from 'react';
import { ImageClassifierResult } from '../types';

interface ImageClassifierProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  onClassificationResult?: (result: string) => void;
}

type PrebuiltModel = 'MobileNet' | 'Darknet' | 'Darknet-tiny' | 'DoodleNet';

const ImageClassifier: React.FC<ImageClassifierProps> = ({ videoRef, isActive, onClassificationResult }) => {
  const [modelType, setModelType] = useState<'prebuilt' | 'custom'>('prebuilt');
  const [prebuiltModel, setPrebuiltModel] = useState<PrebuiltModel>('MobileNet');
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImageClassifierResult[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  
  const classifierRef = useRef<any>(null);
  const isClassifyingRef = useRef(false);
  const classificationTimerRef = useRef<number | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopClassification();
      classifierRef.current = null;
      tempCanvasRef.current = null;
    };
  }, []);

  // Stop classification when inactive
  useEffect(() => {
    if (!isActive) {
      stopClassification();
    }
  }, [isActive]);

  const stopClassification = () => {
    if (classifierRef.current?.classifyStop) {
      try {
        classifierRef.current.classifyStop();
      } catch (e) {
        console.warn("Error stopping classifier:", e);
      }
    }
    if (classificationTimerRef.current) {
      clearTimeout(classificationTimerRef.current);
      classificationTimerRef.current = null;
    }
    isClassifyingRef.current = false;
    setIsClassifying(false);
    setResults([]);
  };

  const loadModel = async () => {
    if (!window.ml5) {
      setError("ML5 library not loaded");
      return;
    }

    // Stop any existing classification
    stopClassification();
    setIsModelLoaded(false);
    setIsLoading(true);
    setError(null);

    try {
      let modelIdentifier: string;

      if (modelType === 'prebuilt') {
        modelIdentifier = prebuiltModel;
      } else {
        if (!customModelUrl.trim()) {
          setError("Please enter a model URL");
          setIsLoading(false);
          return;
        }
        // Handle Teachable Machine URLs
        let url = customModelUrl.trim();
        // If it's a Teachable Machine URL without model.json, append it
        if (url.includes('teachablemachine.withgoogle.com') && !url.endsWith('/')) {
          url = url + '/';
        }
        if (url.includes('teachablemachine.withgoogle.com') && !url.endsWith('model.json')) {
          url = url + 'model.json';
        }
        modelIdentifier = url;
      }

      console.log("Loading model:", modelIdentifier);
      const classifier = await window.ml5.imageClassifier(modelIdentifier);
      classifierRef.current = classifier;
      setIsModelLoaded(true);
      setIsLoading(false);
      setError(null);
      console.log("Model loaded successfully");
    } catch (e: any) {
      console.error("Failed to load model:", e);
      setError(`Failed to load model: ${e.message || 'Unknown error'}`);
      setIsLoading(false);
      setIsModelLoaded(false);
    }
  };

  const startClassification = () => {
    if (!classifierRef.current || !videoRef.current || !isActive) {
      return;
    }

    if (isClassifyingRef.current) {
      return; // Already classifying
    }

    const video = videoRef.current;
    
    // Check if video is ready
    if (video.readyState < 2 || video.videoWidth === 0) {
      console.warn("Video not ready for classification");
      return;
    }

    isClassifyingRef.current = true;
    setIsClassifying(true);

    const classify = () => {
      if (!isClassifyingRef.current || !videoRef.current || !classifierRef.current) {
        return;
      }

      try {
        const video = videoRef.current;
        
        // Only flip for custom Teachable Machine models
        // Pre-built models (MobileNet, Darknet, etc.) should use original orientation
        const shouldFlip = modelType === 'custom';
        
        const handleResults = (classificationResults: ImageClassifierResult[]) => {
          if (!isClassifyingRef.current) return;

          if (classificationResults && Array.isArray(classificationResults)) {
            // Take top 3 results
            const topResults = classificationResults.slice(0, 3);
            setResults(topResults);
            
            // Notify parent component with the top result
            if (topResults.length > 0 && onClassificationResult) {
              onClassificationResult(topResults[0].label);
            }
          }

          // Schedule next classification
          classificationTimerRef.current = window.setTimeout(classify, 500); // Classify every 500ms
        };
        
        if (shouldFlip) {
          // Create a temporary canvas to flip the image (matches Teachable Machine training)
          if (!tempCanvasRef.current) {
            tempCanvasRef.current = document.createElement('canvas');
          }
          
          const tempCanvas = tempCanvasRef.current;
          tempCanvas.width = video.videoWidth;
          tempCanvas.height = video.videoHeight;
          const ctx = tempCanvas.getContext('2d');
          
          if (!ctx) {
            console.error("Failed to get canvas context");
            stopClassification();
            return;
          }
          
          // Flip horizontally to match Teachable Machine's mirror mode
          ctx.save();
          ctx.translate(tempCanvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
          ctx.restore();
          
          // Classify using the flipped canvas
          classifierRef.current.classify(tempCanvas, handleResults);
        } else {
          // For pre-built models, use original video (matches their training data)
          classifierRef.current.classify(video, handleResults);
        }
      } catch (e) {
        console.error("Classification error:", e);
        stopClassification();
      }
    };

    classify();
  };

  // Auto-start classification when model is loaded and component is active
  useEffect(() => {
    if (isModelLoaded && isActive && !isClassifying) {
      // Wait a bit for video to be ready
      const timer = setTimeout(() => {
        startClassification();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isModelLoaded, isActive]);

  return (
    <div className="w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex-none">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">Image Classifier</h3>
          {isModelLoaded && (
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">Model Loaded</span>
          )}
          {isLoading && (
            <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded animate-pulse">Loading...</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto p-4 space-y-4 flex-none max-h-[400px]">
        
        {/* Model Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Model Type</label>
          <div className="bg-gray-900 rounded-lg p-1 flex items-center border border-gray-700">
            <button
              onClick={() => {
                setModelType('prebuilt');
                stopClassification();
                setIsModelLoaded(false);
              }}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                modelType === 'prebuilt'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Pre-built Models
            </button>
            <button
              onClick={() => {
                setModelType('custom');
                stopClassification();
                setIsModelLoaded(false);
              }}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                modelType === 'custom'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Custom URL
            </button>
          </div>
        </div>

        {/* Pre-built Model Selector */}
        {modelType === 'prebuilt' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Model</label>
            <select
              value={prebuiltModel}
              onChange={(e) => {
                setPrebuiltModel(e.target.value as PrebuiltModel);
                stopClassification();
                setIsModelLoaded(false);
              }}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="MobileNet">MobileNet (General Objects)</option>
              <option value="Darknet">Darknet (YOLO - Detailed)</option>
              <option value="Darknet-tiny">Darknet Tiny (YOLO - Fast)</option>
              <option value="DoodleNet">DoodleNet (Drawings)</option>
            </select>
            <div className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-2">
              <p className="text-xs text-gray-400">
                💡 Pre-built models use original video orientation (no mirror flip)
              </p>
            </div>
            <p className="text-xs text-gray-500">
              {prebuiltModel === 'MobileNet' && 'Recognizes 1000 common objects'}
              {prebuiltModel === 'Darknet' && 'Detailed object detection (slower)'}
              {prebuiltModel === 'Darknet-tiny' && 'Fast object detection'}
              {prebuiltModel === 'DoodleNet' && 'Recognizes hand-drawn sketches'}
            </p>
          </div>
        )}

        {/* Custom Model URL Input */}
        {modelType === 'custom' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Teachable Machine URL</label>
            <input
              type="text"
              value={customModelUrl}
              onChange={(e) => setCustomModelUrl(e.target.value)}
              placeholder="https://teachablemachine.withgoogle.com/models/xxxxx/"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-2">
              <p className="text-xs text-blue-300">
                ℹ️ Video is automatically flipped (mirror mode) to match Teachable Machine's training environment
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Enter your Teachable Machine model URL (e.g., https://teachablemachine.withgoogle.com/models/x09vetLC0/)
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Classification Results */}
        {isModelLoaded && results.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Predictions</label>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{result.label}</span>
                    <span className="text-indigo-400 text-xs font-semibold">
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        index === 0 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                        index === 1 ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                        'bg-gradient-to-r from-purple-500 to-pink-400'
                      }`}
                      style={{ width: `${result.confidence * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status when no results */}
        {isModelLoaded && results.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
            Waiting for predictions...
          </div>
        )}

        {/* Load Model prompt */}
        {!isModelLoaded && !isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
            Click "Load Model" to start classifying
          </div>
        )}

      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-700 bg-gray-800 space-y-2 flex-none">
        <button
          onClick={loadModel}
          disabled={isLoading || (modelType === 'custom' && !customModelUrl.trim())}
          className={`w-full py-2.5 rounded-lg font-bold text-white transition-all text-sm ${
            isLoading ? 'bg-gray-600 cursor-wait' :
            (modelType === 'custom' && !customModelUrl.trim()) ? 'bg-gray-700 opacity-50 cursor-not-allowed' :
            'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {isLoading ? 'Loading Model...' : isModelLoaded ? 'Reload Model' : 'Load Model'}
        </button>

        {isModelLoaded && (
          <div className="flex gap-2">
            <button
              onClick={startClassification}
              disabled={isClassifying || !isActive}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
            >
              {isClassifying ? 'Classifying...' : 'Start'}
            </button>
            <button
              onClick={stopClassification}
              disabled={!isClassifying}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageClassifier;

