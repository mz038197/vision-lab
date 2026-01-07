
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Camera from './components/Camera';
import Editor from './components/Editor';
import GestureTrainer from './components/GestureTrainer';
import FaceTrainer from './components/FaceTrainer';
import BodyTrainer from './components/BodyTrainer';
import ImageClassifier from './components/ImageClassifier';
import CombinationClassifier from './components/CombinationClassifier';
import { HandPosePrediction, FaceMeshPrediction, BodyPosePrediction } from './types';

function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  // Change to multiple selection instead of single mode
  const [activeModes, setActiveModes] = useState<{
    face: boolean;
    hand: boolean;
    body: boolean;
    classifier: boolean;
  }>({
    face: false,
    hand: false,
    body: false,
    classifier: false,
  });
  const [bodyPoseModel, setBodyPoseModel] = useState<'MoveNet' | 'BlazePose'>('MoveNet');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Use Ref instead of State for high-frequency data to prevent re-renders (60fps)
  const handPoseResultsRef = useRef<HandPosePrediction[]>([]);
  const faceMeshResultsRef = useRef<FaceMeshPrediction[]>([]);
  const bodyPoseResultsRef = useRef<BodyPosePrediction[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Store latest classification results for combination classifier
  const [faceClassification, setFaceClassification] = useState<string>('');
  const [handClassification, setHandClassification] = useState<string>('');
  const [bodyClassification, setBodyClassification] = useState<string>('');
  const [imageClassification, setImageClassification] = useState<string>('');

  // Verify backend is set correctly (already configured in index.html)
  useEffect(() => {
    const verifyBackend = () => {
      if (window.tf && window.tf.getBackend) {
        const backend = window.tf.getBackend();
        console.log(`✅ Current TensorFlow.js backend: ${backend}`);
        if (backend !== 'webgl') {
          console.warn(`⚠️ Warning: Backend is ${backend}, expected webgl`);
        }
      }
      if (window.ml5) {
        console.log('✅ ml5.js loaded and ready');
      }
    };
    
    // Wait a bit for libraries to initialize
    setTimeout(verifyBackend, 500);
  }, []);

  const toggleCamera = () => {
    setIsCameraActive(!isCameraActive);
    if (isCameraActive) {
      // Reset all modes when camera is turned off
      setActiveModes({
        face: false,
        hand: false,
        body: false,
        classifier: false,
      });
      handPoseResultsRef.current = [];
      faceMeshResultsRef.current = [];
      bodyPoseResultsRef.current = [];
    }
  };

  const toggleMode = (mode: 'face' | 'hand' | 'body' | 'classifier') => {
    setActiveModes(prev => ({
      ...prev,
      [mode]: !prev[mode]
    }));
    
    // Clear data when disabling a mode
    if (activeModes[mode]) {
      if (mode === 'hand') handPoseResultsRef.current = [];
      if (mode === 'face') faceMeshResultsRef.current = [];
      if (mode === 'body') bodyPoseResultsRef.current = [];
    }
  };

  const handleCapture = useCallback((imageData: string) => {
    setCapturedImage(imageData);
  }, []);

  // Optimization: Update ref directly, do not trigger React state update
  const handleHandResults = useCallback((results: HandPosePrediction[]) => {
      handPoseResultsRef.current = results;
  }, []);

  const handleFaceResults = useCallback((results: FaceMeshPrediction[]) => {
      faceMeshResultsRef.current = results;
  }, []);

  const handleBodyResults = useCallback((results: BodyPosePrediction[]) => {
      bodyPoseResultsRef.current = results;
  }, []);

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col font-sans overflow-hidden">
      {/* Header - Fixed at top */}
      <header className="px-6 py-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur-md z-30 flex-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Vision Lab</h1>
              <p className="text-xs text-gray-400">Vans coding & ml5.js</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-sm text-gray-400">
             <span>v1.0.0</span>
             <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
             <span>Powered by Google GenAI</span>
          </div>
        </div>
      </header>

      {/* Main Content - Fixed Height, No Scroll */}
      <main className="flex-1 overflow-hidden p-4 md:p-6 w-full flex flex-col">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4 h-full">
          
          {/* Control Panel - Fixed at Top */}
          <div className="flex-none flex flex-wrap items-center justify-center gap-4">
             {/* Camera Toggle */}
             <button
               onClick={toggleCamera}
               className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all shadow-lg transform active:scale-95 ${
                 isCameraActive 
                   ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
                   : 'bg-indigo-600 text-white border border-transparent hover:bg-indigo-500 hover:shadow-indigo-500/25'
               }`}
             >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isCameraActive 
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  }
               </svg>
               {isCameraActive ? 'Stop Camera' : 'Start Camera'}
             </button>

             {/* Detection Mode Selectors */}
             <div className="flex flex-wrap items-center gap-2">
               {[
                 { key: 'face' as const, label: 'Face Mesh', icon: '👤' },
                 { key: 'hand' as const, label: 'Hand Pose', icon: '✋' },
                 { key: 'body' as const, label: 'Body Pose', icon: '🏃' },
                 { key: 'classifier' as const, label: 'Classifier', icon: '🔍' }
               ].map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => toggleMode(key)}
                    disabled={!isCameraActive}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                      activeModes[key] && isCameraActive
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25'
                        : isCameraActive
                        ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                        : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                    {activeModes[key] && isCameraActive && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
               ))}
             </div>

             {/* BodyPose Model Selector - Only show when body mode is active */}
             {isCameraActive && activeModes.body && (
               <div className="bg-gray-800 rounded-full p-1 flex items-center border border-gray-700 shadow-inner">
                 <button
                   onClick={() => setBodyPoseModel('MoveNet')}
                   className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                     bodyPoseModel === 'MoveNet'
                       ? 'bg-blue-600 text-white shadow-sm'
                       : 'text-gray-400 hover:text-gray-200'
                   }`}
                 >
                   MoveNet
                 </button>
                 <button
                   onClick={() => setBodyPoseModel('BlazePose')}
                   className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                     bodyPoseModel === 'BlazePose'
                       ? 'bg-blue-600 text-white shadow-sm'
                       : 'text-gray-400 hover:text-gray-200'
                   }`}
                 >
                   BlazePose
                 </button>
               </div>
             )}
          </div>

          {/* Main Layout: Camera + Trainer Side by Side - Fill Remaining Height */}
          <div className={`flex-1 flex flex-col ${isCameraActive && (activeModes.hand || activeModes.face || activeModes.body || activeModes.classifier) ? 'lg:flex-row' : ''} gap-4 items-start overflow-hidden`}>
            
            {/* Camera Viewport - Fixed, No Scroll */}
            <div className={`${isCameraActive && (activeModes.hand || activeModes.face || activeModes.body || activeModes.classifier) ? 'lg:flex-1 lg:max-w-[60%]' : 'w-full max-w-4xl mx-auto'} shrink-0 flex flex-col items-center h-full`}>
              <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative group">
                <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-indigo-500/50 rounded-tl-2xl z-20 pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-indigo-500/50 rounded-tr-2xl z-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-indigo-500/50 rounded-bl-2xl z-20 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-indigo-500/50 rounded-br-2xl z-20 pointer-events-none"></div>

                <Camera 
                  isActive={isCameraActive} 
                  activeModes={activeModes}
                  bodyPoseModel={bodyPoseModel}
                  onCapture={handleCapture}
                  onHandResults={handleHandResults}
                  onFaceResults={handleFaceResults}
                  onBodyResults={handleBodyResults}
                  videoRef={videoRef}
                />
              </div>
              
              {!(isCameraActive && (activeModes.hand || activeModes.face || activeModes.body || activeModes.classifier)) && (
                <div className="text-center text-gray-500 text-sm mt-4">
                  <p>1. Start the camera. 2. Select one or more detection modes (Face, Hand, Body, Classifier). 3. Capture a photo to edit with AI.</p>
                </div>
              )}
            </div>

            {/* Trainer Panels - Independent Scroll Area */}
            {isCameraActive && (activeModes.hand || activeModes.face || activeModes.body || activeModes.classifier) && (
              <div className="w-full lg:w-[40%] lg:min-w-[420px] h-full overflow-y-auto space-y-4 pr-2">
                {/* Gesture Trainer Section */}
                {activeModes.hand && (
                  <div className="w-full flex-shrink-0">
                    <GestureTrainer 
                      handPoseDataRef={handPoseResultsRef}
                      onClassificationResult={setHandClassification}
                    />
                  </div>
                )}

                {/* Face Trainer Section */}
                {activeModes.face && (
                  <div className="w-full flex-shrink-0">
                    <FaceTrainer 
                      faceMeshDataRef={faceMeshResultsRef}
                      onClassificationResult={setFaceClassification}
                    />
                  </div>
                )}

                {/* Body Trainer Section */}
                {activeModes.body && (
                  <div className="w-full flex-shrink-0">
                    <BodyTrainer 
                      bodyPoseDataRef={bodyPoseResultsRef}
                      onClassificationResult={setBodyClassification}
                    />
                  </div>
                )}

                {/* Image Classifier Section */}
                {activeModes.classifier && (
                  <div className="w-full flex-shrink-0">
                    <ImageClassifier 
                      videoRef={videoRef} 
                      isActive={isCameraActive && activeModes.classifier}
                      onClassificationResult={setImageClassification}
                    />
                  </div>
                )}

                {/* Combination Classifier - Show when 2 or more modules are active */}
                {(() => {
                  const activeCount = [
                    activeModes.face,
                    activeModes.hand,
                    activeModes.body,
                    activeModes.classifier
                  ].filter(Boolean).length;
                  
                  return activeCount >= 2 ? (
                    <div className="w-full flex-shrink-0">
                      <CombinationClassifier
                        faceResult={faceClassification}
                        handResult={handClassification}
                        bodyResult={bodyClassification}
                        imageResult={imageClassification}
                        activeModes={{
                          face: activeModes.face,
                          hand: activeModes.hand,
                          body: activeModes.body,
                          classifier: activeModes.classifier
                        }}
                      />
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Editor Modal */}
      {capturedImage && (
        <Editor 
          imageData={capturedImage} 
          onClose={() => setCapturedImage(null)} 
        />
      )}
    </div>
  );
}

export default App;
