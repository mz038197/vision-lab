
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMeshPrediction, HandPosePrediction } from '../types';

interface CameraProps {
  isActive: boolean;
  activeMode: 'none' | 'face' | 'hand';
  onCapture: (imageData: string) => void;
  onHandResults?: (results: HandPosePrediction[]) => void;
}

const Camera: React.FC<CameraProps> = ({ isActive, activeMode, onCapture, onHandResults }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState({ face: false, hand: false });
  const [error, setError] = useState<string | null>(null);
  
  // Refs for ml5 instances
  const faceMeshRef = useRef<any>(null);
  const handPoseRef = useRef<any>(null);
  const loadingLockRef = useRef(false);
  
  // Ref to track detection state
  const isDetectingRef = useRef(false);
  const activeModeRef = useRef(activeMode); // Keep track of active mode in ref for render loop

  // Refs for data to decouple detection rate from render rate
  const latestFacePredictionsRef = useRef<FaceMeshPrediction[]>([]);
  const latestHandPredictionsRef = useRef<HandPosePrediction[]>([]);
  const lastHandDetectTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Ref for callback to avoid effect dependency cycles
  const onHandResultsRef = useRef(onHandResults);

  // Update refs when props change
  useEffect(() => {
    onHandResultsRef.current = onHandResults;
  }, [onHandResults]);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  // Start/Stop Camera Stream
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        if (isActive && !stream) {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user"
            }
          });
          if (!isMounted) {
            mediaStream.getTracks().forEach(track => track.stop());
            return;
          }
          currentStream = mediaStream;
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
          }
          setError(null);
        } else if (!isActive && stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        if (isMounted) setError("Unable to access camera. Please allow permissions.");
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]); // Removed 'stream' from deps to avoid cycle

  // Initialize ML5 Models
  useEffect(() => {
    const initModels = async () => {
      // Skip if already loading or loaded
      if (loadingLockRef.current) {
        // If models are already loaded in refs, sync state
        if (faceMeshRef.current && handPoseRef.current) {
          setModelsLoaded({ face: true, hand: true });
        }
        return;
      }
      
      let attempts = 0;
      while (!window.ml5 && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }

      if (!window.ml5) {
        setError("ML5 library failed to load.");
        return;
      }
      
      loadingLockRef.current = true;

      try {
        if (!faceMeshRef.current) {
          const faceOptions = {
            maxFaces: 1,
            refineLandmarks: true,
            flipped: false
          };
          faceMeshRef.current = await window.ml5.faceMesh(faceOptions);
        }
        setModelsLoaded(prev => ({ ...prev, face: true }));

        if (!handPoseRef.current) {
          const handOptions = {
            maxHands: 2,
            flipped: false
          };
          handPoseRef.current = await window.ml5.handPose(handOptions);
        }
        setModelsLoaded(prev => ({ ...prev, hand: true }));
      } catch (e) {
        console.error("Failed to initialize models:", e);
        setError("Failed to load AI models.");
      }
    };

    initModels();
  }, []);

  // Stable Render Loop (does not depend on props)
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const currentMode = activeModeRef.current;
    
    if (!canvas || !video) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
    }

    // Ensure canvas matches video size to prevent scaling artifacts
    if (video.videoWidth > 0 && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;

    if (currentMode === 'face') {
        const predictions = latestFacePredictionsRef.current;
        if (predictions && predictions.length > 0) {
            const time = performance.now() / 200; 
            predictions.forEach((prediction) => {
                const keypoints = prediction.keypoints;
                if (!keypoints) return;
                
                keypoints.forEach((point, i) => {
                  const wave = Math.sin(time + i * 0.15); 
                  const alpha = 0.6 + (wave * 0.3);
                  ctx.fillStyle = `rgba(0, 255, 200, ${alpha})`;
                  ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
                });
            });
        }
    } else if (currentMode === 'hand') {
        const predictions = latestHandPredictionsRef.current;
        const now = performance.now();
        const timeSinceLastDetection = now - lastHandDetectTimeRef.current;
        
        // Only draw if detection is recent (< 500ms) to avoid "stuck" hands
        if (predictions && predictions.length > 0 && timeSinceLastDetection < 500) {
            if (timeSinceLastDetection > 200) {
                // Fade out old detections
                ctx.globalAlpha = 1 - ((timeSinceLastDetection - 200) / 300);
            } else {
                ctx.globalAlpha = 1.0;
            }

            predictions.forEach((prediction) => {
                const keypoints = prediction.keypoints;
                if (!keypoints) return;

                const fingers = [
                  [0, 1, 2, 3, 4], 
                  [0, 5, 6, 7, 8], 
                  [0, 9, 10, 11, 12], 
                  [0, 13, 14, 15, 16], 
                  [0, 17, 18, 19, 20]
                ];

                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';

                fingers.forEach((finger, idx) => {
                   const hue = 20 + (idx * 40);
                   ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
                   ctx.beginPath();
                   finger.forEach((pointIdx, i) => {
                     const p = keypoints[pointIdx];
                     if (i === 0) ctx.moveTo(p.x, p.y);
                     else ctx.lineTo(p.x, p.y);
                   });
                   ctx.stroke();
                });

                keypoints.forEach((point) => {
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                  ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
                });
            });
        }
    }

    animationFrameRef.current = requestAnimationFrame(renderLoop);
  }, []); // Empty dependencies = stable function


  // Handle Detection Logic
  useEffect(() => {
    let detectionInterval: number | null = null;
    let detectionStartTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Start the render loop immediately
    animationFrameRef.current = requestAnimationFrame(renderLoop);

    const stopDetection = () => {
      if (detectionInterval) clearInterval(detectionInterval);
      if (detectionStartTimeout) clearTimeout(detectionStartTimeout);
      
      try {
        // Stop both models to be safe when switching or unmounting
        if (faceMeshRef.current?.detectStop) faceMeshRef.current.detectStop();
        if (handPoseRef.current?.detectStop) handPoseRef.current.detectStop();
      } catch (e) {
          console.warn("Error stopping models", e);
      }

      isDetectingRef.current = false;
      latestFacePredictionsRef.current = [];
      latestHandPredictionsRef.current = [];
      lastHandDetectTimeRef.current = 0;
      
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };

    const startDetection = () => {
      // 1. Clean up previous detection first
      stopDetection();
      
      if (activeMode === 'none') return;
      if (!isActive || !stream) return;

      // 2. Debounce start: Wait 300ms before starting new detection.
      // This prevents rapid switching from crashing the browser and gives DOM time to settle.
      detectionStartTimeout = setTimeout(() => {
        const video = videoRef.current;
        
        // 3. Poll for readiness (Video + Model)
        // We poll instead of depending on 'modelsLoaded' state to avoid useEffect re-triggering loop
        detectionInterval = window.setInterval(() => {
          if (!video || video.paused || video.ended) return;
          
          const model = activeMode === 'face' ? faceMeshRef.current : handPoseRef.current;

          // Check if everything is ready
          if (video.readyState >= 2 && video.videoWidth > 0 && model) {
            // Stop polling
            clearInterval(detectionInterval as any);
            detectionInterval = null;
            
            // Critical: Explicitly set video dims to avoid internal tensor reshaping crashes
            if (video.width !== video.videoWidth || video.height !== video.videoHeight) {
                video.width = video.videoWidth;
                video.height = video.videoHeight;
            }

            if (!isDetectingRef.current) {
              isDetectingRef.current = true;
              
              try {
                // ml5 detectStart runs a continuous loop internally
                model.detectStart(video, (results: any[]) => {
                   if (activeModeRef.current !== activeMode) return; // Safety check

                   if (activeMode === 'face') {
                      latestFacePredictionsRef.current = results as FaceMeshPrediction[];
                   } else if (activeMode === 'hand') {
                      const handResults = results as HandPosePrediction[];
                      if (handResults && handResults.length > 0) {
                          latestHandPredictionsRef.current = handResults;
                          lastHandDetectTimeRef.current = performance.now();
                      }
                      if (onHandResultsRef.current) {
                          onHandResultsRef.current(handResults);
                      }
                   }
                });
              } catch (err) {
                console.error("Error during detectStart:", err);
                isDetectingRef.current = false;
              }
            }
          }
        }, 200); // Poll every 200ms
      }, 300); // 300ms debounce delay
    };

    if (isActive && stream) {
      startDetection();
    } else {
      stopDetection();
    }

    return () => {
      stopDetection();
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isActive, activeMode, stream, renderLoop]); // Removed 'modelsLoaded' to prevent restart loops

  const captureImage = useCallback(() => {
    if (videoRef.current) {
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = videoRef.current.videoWidth;
      captureCanvas.height = videoRef.current.videoHeight;
      const ctx = captureCanvas.getContext('2d');
      
      if (ctx) {
        ctx.translate(captureCanvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, captureCanvas.width, captureCanvas.height);
        
        const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.9);
        onCapture(dataUrl);
      }
    }
  }, [onCapture]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden shadow-2xl ring-1 ring-gray-700">
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-gray-400">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p>Camera is off</p>
        </div>
      )}
      
      <video
        ref={videoRef}
        playsInline
        muted
        onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement;
            video.play().catch(console.error);
        }}
        className={`w-full h-full object-cover transform ${isActive ? 'scale-x-[-1]' : ''}`}
        style={{ display: isActive ? 'block' : 'none' }}
      />

      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none transform scale-x-[-1]"
        style={{ display: isActive ? 'block' : 'none' }}
      />

      {isActive && activeMode !== 'none' && (!modelsLoaded.face || !modelsLoaded.hand) && (
        <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs text-yellow-300 border border-yellow-500/30 animate-pulse">
          Loading Models...
        </div>
      )}

      {isActive && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
          <button
            onClick={captureImage}
            className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-white border-4 border-gray-300 shadow-lg hover:bg-gray-100 active:scale-95 transition-all focus:outline-none"
            aria-label="Capture Photo"
          >
            <div className="w-12 h-12 rounded-full bg-red-500 group-hover:bg-red-600 transition-colors" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Camera;
