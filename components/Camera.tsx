
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMeshPrediction, HandPosePrediction, BodyPosePrediction } from '../types';
import '../types'; // Import to register global Window types

interface CameraProps {
  isActive: boolean;
  activeModes: {
    face: boolean;
    hand: boolean;
    body: boolean;
    classifier: boolean;
  };
  bodyPoseModel?: 'MoveNet' | 'BlazePose';
  onCapture: (imageData: string) => void;
  onHandResults?: (results: HandPosePrediction[]) => void;
  onFaceResults?: (results: FaceMeshPrediction[]) => void;
  onBodyResults?: (results: BodyPosePrediction[]) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

const Camera: React.FC<CameraProps> = ({ isActive, activeModes, bodyPoseModel = 'MoveNet', onCapture, onHandResults, onFaceResults, onBodyResults, videoRef: externalVideoRef }) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState({ face: false, hand: false, body: false });
  const [error, setError] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState(0); // Trigger detection restart on model change
  
  // Refs for ml5 instances
  const faceMeshRef = useRef<any>(null);
  const handPoseRef = useRef<any>(null);
  const bodyPoseRef = useRef<any>(null);
  const loadingLockRef = useRef(false);
  const modelsLoadedRef = useRef({ face: false, hand: false, body: false });
  
  // Ref to track detection state for each model
  const isDetectingRef = useRef({
    face: false,
    hand: false,
    body: false
  });
  const activeModesRef = useRef(activeModes); // Keep track of active modes in ref for render loop
  const bodyPoseModelRef = useRef(bodyPoseModel);

  // Refs for data to decouple detection rate from render rate
  const latestFacePredictionsRef = useRef<FaceMeshPrediction[]>([]);
  const latestHandPredictionsRef = useRef<HandPosePrediction[]>([]);
  const latestBodyPredictionsRef = useRef<BodyPosePrediction[]>([]);
  const lastHandDetectTimeRef = useRef<number>(0);
  const lastBodyDetectTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const memoryCleanupIntervalRef = useRef<number | null>(null);

  // Ref for callbacks to avoid effect dependency cycles
  const onHandResultsRef = useRef(onHandResults);
  const onFaceResultsRef = useRef(onFaceResults);
  const onBodyResultsRef = useRef(onBodyResults);

  // Update refs when props change
  useEffect(() => {
    onHandResultsRef.current = onHandResults;
  }, [onHandResults]);

  useEffect(() => {
    onFaceResultsRef.current = onFaceResults;
  }, [onFaceResults]);

  useEffect(() => {
    onBodyResultsRef.current = onBodyResults;
  }, [onBodyResults]);

  useEffect(() => {
    activeModesRef.current = activeModes;
  }, [activeModes]);

  useEffect(() => {
    bodyPoseModelRef.current = bodyPoseModel;
  }, [bodyPoseModel]);

  // Sync modelsLoaded state to ref for use in detection loop
  useEffect(() => {
    modelsLoadedRef.current = modelsLoaded;
  }, [modelsLoaded]);

  // GPU Memory Cleanup - Run periodically to prevent memory leaks
  useEffect(() => {
    const cleanupGPUMemory = async () => {
      try {
        // Check if TensorFlow.js is fully initialized
        if (!window.tf || typeof window.tf.engine !== 'function') {
          return; // Skip if TensorFlow.js is not ready
        }
        
        const engine = window.tf.engine();
        if (!engine) {
          return; // Skip if engine is not available
        }
        
        // Use async memory API if available (better for WebGPU)
        let memoryInfoBefore: any = null;
        
        // Try to get memory info asynchronously if supported
        if (window.tf.memory) {
          try {
            // For WebGPU backend, avoid synchronous memory reads
            const backend = engine.backend;
            if (backend && backend.constructor && backend.constructor.name !== 'MathBackendWebGPU') {
              // Safe to use memory() on WebGL/CPU backends
              memoryInfoBefore = window.tf.memory();
            }
          } catch (e) {
            // Silently skip if memory info not available
          }
        }
        
        // Clean up unused tensors using tidy
        if (window.tf.nextFrame) {
          await window.tf.nextFrame(); // Allow pending operations to complete
        }
        
        // Safe scope management
        if (engine.startScope && engine.endScope) {
          engine.startScope();
          engine.endScope();
        }
        
        // Force garbage collection of textures
        if (window.tf.tidy) {
          window.tf.tidy(() => {});
        }
        
        // Dispose any leaked tensors
        if (window.tf.disposeVariables) {
          window.tf.disposeVariables();
        }
        
        // Log cleanup info only if we have memory data (non-WebGPU)
        if (memoryInfoBefore) {
          try {
            const memoryInfoAfter = window.tf.memory();
            const freedTensors = memoryInfoBefore.numTensors - memoryInfoAfter.numTensors;
            const freedBytes = memoryInfoBefore.numBytes - memoryInfoAfter.numBytes;
            
            if (freedTensors > 0 || freedBytes > 0) {
              console.log(`🧹 GPU Memory Cleanup: Released ${freedTensors} tensors, freed ${(freedBytes / 1024 / 1024).toFixed(2)} MB`);
            }
          } catch (e) {
            // Skip logging if memory read fails
          }
        }
      } catch (error) {
        console.warn('GPU memory cleanup failed:', error);
      }
    };

    // Delay first cleanup to ensure TensorFlow.js is fully initialized
    const startCleanup = () => {
      // Run cleanup every 30 seconds
      memoryCleanupIntervalRef.current = window.setInterval(() => {
        cleanupGPUMemory(); // Call async function
      }, 30000);
      console.log('🚀 GPU memory cleanup scheduled (every 30 seconds)');
    };
    
    // Wait 3 seconds before starting cleanup to ensure everything is initialized
    const startTimeout = setTimeout(startCleanup, 3000);

    return () => {
      clearTimeout(startTimeout);
      if (memoryCleanupIntervalRef.current) {
        clearInterval(memoryCleanupIntervalRef.current);
        memoryCleanupIntervalRef.current = null;
        console.log('🛑 GPU memory cleanup stopped');
      }
    };
  }, []);

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
        if (faceMeshRef.current && handPoseRef.current && bodyPoseRef.current) {
          setModelsLoaded({ face: true, hand: true, body: true });
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
          console.log('Face Mesh model loaded successfully');
        }
        setModelsLoaded(prev => ({ ...prev, face: true }));
        modelsLoadedRef.current.face = true;

        if (!handPoseRef.current) {
          const handOptions = {
            maxHands: 2,
            flipped: false
          };
          handPoseRef.current = await window.ml5.handPose(handOptions);
        }
        setModelsLoaded(prev => ({ ...prev, hand: true }));
        modelsLoadedRef.current.hand = true;

        // Initialize bodyPose with default MoveNet model
        if (!bodyPoseRef.current) {
          bodyPoseRef.current = await window.ml5.bodyPose('MoveNet');
        }
        setModelsLoaded(prev => ({ ...prev, body: true }));
        modelsLoadedRef.current.body = true;
      } catch (e) {
        console.error("Failed to initialize models:", e);
        setError("Failed to load AI models.");
      }
    };

    initModels();
  }, []);

  // Handle BodyPose Model Switching
  useEffect(() => {
    const switchBodyPoseModel = async () => {
      if (!window.ml5) return;
      
      // Only switch if body mode is active
      if (!activeModes.body && !activeModesRef.current.body) return;
      
      try {
        // Stop current detection
        if (bodyPoseRef.current?.detectStop) {
          bodyPoseRef.current.detectStop();
        }
        
        isDetectingRef.current.body = false;
        latestBodyPredictionsRef.current = []; // Clear old predictions
        
        // Load new model
        setModelsLoaded(prev => ({ ...prev, body: false }));
        modelsLoadedRef.current.body = false;
        console.log(`Switching to ${bodyPoseModel} model...`);
        bodyPoseRef.current = await window.ml5.bodyPose(bodyPoseModel as 'MoveNet' | 'BlazePose');
        console.log(`${bodyPoseModel} model loaded successfully`);
        setModelsLoaded(prev => ({ ...prev, body: true }));
        modelsLoadedRef.current.body = true;
        
        // Trigger detection restart immediately
        setModelVersion(prev => prev + 1);
        
      } catch (e) {
        console.error("Failed to switch bodyPose model:", e);
        setError(`Failed to load ${bodyPoseModel} model.`);
      }
    };

    switchBodyPoseModel();
  }, [bodyPoseModel]);

  // Stable Render Loop (does not depend on props)
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const currentModes = activeModesRef.current;
    
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

    // Draw face mesh if active
    if (currentModes.face) {
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
    }
    
    // Draw hand pose if active
    if (currentModes.hand) {
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
            
            ctx.globalAlpha = 1.0; // Reset alpha
        }
    }
    
    // Draw body pose if active
    if (currentModes.body) {
        const predictions = latestBodyPredictionsRef.current;
        const now = performance.now();
        const timeSinceLastDetection = now - lastBodyDetectTimeRef.current;
        
        // Only draw if detection is recent (< 500ms)
        if (predictions && predictions.length > 0 && timeSinceLastDetection < 500) {
            if (timeSinceLastDetection > 200) {
                ctx.globalAlpha = 1 - ((timeSinceLastDetection - 200) / 300);
            } else {
                ctx.globalAlpha = 1.0;
            }

            predictions.forEach((prediction) => {
                const keypoints = prediction.keypoints;
                if (!keypoints) return;

                // Draw skeleton connections
                const connections = [
                  // Torso
                  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
                  [5, 11], [6, 12], [11, 12],
                  // Legs
                  [11, 13], [13, 15], [12, 14], [14, 16],
                  // Face
                  [0, 1], [0, 2], [1, 3], [2, 4]
                ];

                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
                ctx.lineCap = 'round';

                connections.forEach(([startIdx, endIdx]) => {
                  const start = keypoints[startIdx];
                  const end = keypoints[endIdx];
                  if (start && end && start.confidence > 0.3 && end.confidence > 0.3) {
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    ctx.stroke();
                  }
                });

                // Draw keypoints
                keypoints.forEach((point) => {
                  if (point.confidence > 0.3) {
                    ctx.fillStyle = 'rgba(255, 0, 100, 0.9)';
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
                    ctx.fill();
                  }
                });
            });
            
            ctx.globalAlpha = 1.0; // Reset alpha
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
        // Stop all models to be safe when switching or unmounting
        if (faceMeshRef.current?.detectStop) faceMeshRef.current.detectStop();
        if (handPoseRef.current?.detectStop) handPoseRef.current.detectStop();
        if (bodyPoseRef.current?.detectStop) bodyPoseRef.current.detectStop();
      } catch (e) {
          console.warn("Error stopping models", e);
      }

      isDetectingRef.current = { face: false, hand: false, body: false };
      latestFacePredictionsRef.current = [];
      latestHandPredictionsRef.current = [];
      latestBodyPredictionsRef.current = [];
      lastHandDetectTimeRef.current = 0;
      lastBodyDetectTimeRef.current = 0;
      
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      
      // Clean up GPU memory after stopping detection (async safe)
      if (window.tf && typeof window.tf.engine === 'function') {
        try {
          const engine = window.tf.engine();
          if (!engine) return;
          
          // Use nextFrame to avoid sync GPU reads
          if (window.tf.nextFrame) {
            window.tf.nextFrame().then(() => {
              if (window.tf && typeof window.tf.engine === 'function') {
                const eng = window.tf.engine();
                if (eng && eng.startScope && eng.endScope) {
                  eng.startScope();
                  eng.endScope();
                }
                if (window.tf.tidy) {
                  window.tf.tidy(() => {});
                }
              }
            }).catch((e) => {
              console.warn("Error cleaning GPU memory on stop:", e);
            });
          } else if (engine.startScope && engine.endScope) {
            engine.startScope();
            engine.endScope();
            if (window.tf.tidy) {
              window.tf.tidy(() => {});
            }
          }
        } catch (e) {
          console.warn("Error cleaning GPU memory on stop:", e);
        }
      }
    };

    const startDetection = () => {
      // 1. Clean up previous detection first
      stopDetection();
      
      // Check if any mode is active (excluding classifier which doesn't need detection)
      const hasActiveMode = activeModes.face || activeModes.hand || activeModes.body;
      if (!hasActiveMode || !isActive || !stream) return;

      // 2. Debounce start: Wait 100ms before starting new detection.
      // This prevents rapid switching from crashing the browser and gives DOM time to settle.
      detectionStartTimeout = setTimeout(() => {
        const video = videoRef.current;
        
        // 3. Poll for readiness (Video + Models)
        detectionInterval = window.setInterval(() => {
          if (!video || video.paused || video.ended) return;
          
          // Check if everything is ready
          if (video.readyState >= 2 && video.videoWidth > 0) {
            // Stop polling
            clearInterval(detectionInterval as any);
            detectionInterval = null;
            
            // Critical: Explicitly set video dims to avoid internal tensor reshaping crashes
            if (video.width !== video.videoWidth || video.height !== video.videoHeight) {
                video.width = video.videoWidth;
                video.height = video.videoHeight;
            }

            // Start face detection if active and model is loaded
            if (activeModes.face && faceMeshRef.current && modelsLoadedRef.current.face && !isDetectingRef.current.face) {
              isDetectingRef.current.face = true;
              try {
                faceMeshRef.current.detectStart(video, (results: any[]) => {
                   if (!activeModesRef.current.face) return; // Safety check

                   const faceResults = results as FaceMeshPrediction[];
                   latestFacePredictionsRef.current = faceResults;
                   if (onFaceResultsRef.current) {
                       onFaceResultsRef.current(faceResults);
                   }
                });
                console.log('Face detection started');
              } catch (err) {
                console.error("Error starting face detection:", err);
                isDetectingRef.current.face = false;
              }
            }

            // Start hand detection if active and model is loaded
            if (activeModes.hand && handPoseRef.current && modelsLoadedRef.current.hand && !isDetectingRef.current.hand) {
              isDetectingRef.current.hand = true;
              try {
                handPoseRef.current.detectStart(video, (results: any[]) => {
                   if (!activeModesRef.current.hand) return; // Safety check

                   const handResults = results as HandPosePrediction[];
                   if (handResults && handResults.length > 0) {
                       latestHandPredictionsRef.current = handResults;
                       lastHandDetectTimeRef.current = performance.now();
                   }
                   if (onHandResultsRef.current) {
                       onHandResultsRef.current(handResults);
                   }
                });
                console.log('Hand detection started');
              } catch (err) {
                console.error("Error starting hand detection:", err);
                isDetectingRef.current.hand = false;
              }
            }

            // Start body detection if active and model is loaded
            if (activeModes.body && bodyPoseRef.current && modelsLoadedRef.current.body && !isDetectingRef.current.body) {
              isDetectingRef.current.body = true;
              try {
                bodyPoseRef.current.detectStart(video, (results: any[]) => {
                   if (!activeModesRef.current.body) return; // Safety check

                   const bodyResults = results as BodyPosePrediction[];
                   if (bodyResults && bodyResults.length > 0) {
                       latestBodyPredictionsRef.current = bodyResults;
                       lastBodyDetectTimeRef.current = performance.now();
                   }
                   if (onBodyResultsRef.current) {
                       onBodyResultsRef.current(bodyResults);
                   }
                });
                console.log('Body detection started');
              } catch (err) {
                console.error("Error starting body detection:", err);
                isDetectingRef.current.body = false;
              }
            }
          }
        }, 200); // Poll every 200ms
      }, 100); // 100ms debounce delay
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
  }, [isActive, activeModes.face, activeModes.hand, activeModes.body, stream, renderLoop, modelVersion, modelsLoaded.face, modelsLoaded.hand, modelsLoaded.body]); // React to individual mode changes and model loading

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

      {isActive && (activeModes.face || activeModes.hand || activeModes.body) && (!modelsLoaded.face || !modelsLoaded.hand || !modelsLoaded.body) && (
        <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs text-yellow-300 border border-yellow-500/30 animate-pulse">
          Loading Models...
        </div>
      )}
    </div>
  );
};

export default Camera;
