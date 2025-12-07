
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Camera from './components/Camera';
import Editor from './components/Editor';
import GestureTrainer from './components/GestureTrainer';
import { HandPosePrediction } from './types';

function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeMode, setActiveMode] = useState<'none' | 'face' | 'hand'>('none');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Use Ref instead of State for high-frequency data to prevent re-renders (60fps)
  const handPoseResultsRef = useRef<HandPosePrediction[]>([]);

  // Set ml5.js backend to WebGL
  useEffect(() => {
    const setBackend = async () => {
      if (window.ml5) {
        try {
          await window.ml5.setBackend('webgl');
          console.log('ml5.js backend set to WebGL');
        } catch (error) {
          console.warn('Failed to set ml5 backend:', error);
        }
      }
    };
    setBackend();
  }, []);

  const toggleCamera = () => {
    setIsCameraActive(!isCameraActive);
    if (isCameraActive) {
      setActiveMode('none');
      handPoseResultsRef.current = [];
    }
  };

  const handleCapture = useCallback((imageData: string) => {
    setCapturedImage(imageData);
  }, []);

  // Optimization: Update ref directly, do not trigger React state update
  const handleHandResults = useCallback((results: HandPosePrediction[]) => {
      handPoseResultsRef.current = results;
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
              <p className="text-xs text-gray-400">Gemini Nano & ml5.js</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-sm text-gray-400">
             <span>v1.0.0</span>
             <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
             <span>Powered by Google GenAI</span>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full scroll-smooth">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4">
          
          {/* Control Panel */}
          <div className="flex flex-wrap items-center justify-center gap-4">
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
             <div className="bg-gray-800 rounded-full p-1 flex items-center border border-gray-700 shadow-inner">
               {['none', 'face', 'hand'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                        setActiveMode(mode as any);
                        if (mode !== 'hand') handPoseResultsRef.current = [];
                    }}
                    disabled={!isCameraActive}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                      activeMode === mode && isCameraActive
                        ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-600'
                        : 'text-gray-400 hover:text-gray-200'
                    } ${!isCameraActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {mode === 'none' && 'No Effects'}
                    {mode === 'face' && 'Face Mesh'}
                    {mode === 'hand' && 'Hand Pose'}
                  </button>
               ))}
             </div>
          </div>

          {/* Main Layout: Camera + Trainer Side by Side */}
          <div className={`flex flex-col ${isCameraActive && activeMode === 'hand' ? 'lg:flex-row' : ''} gap-4 items-start`}>
            
            {/* Camera Viewport */}
            <div className={`${isCameraActive && activeMode === 'hand' ? 'lg:flex-1 lg:max-w-[60%]' : 'w-full max-w-4xl mx-auto'} shrink-0`}>
              <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative group">
                <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-indigo-500/50 rounded-tl-2xl z-20 pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-indigo-500/50 rounded-tr-2xl z-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-indigo-500/50 rounded-bl-2xl z-20 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-indigo-500/50 rounded-br-2xl z-20 pointer-events-none"></div>

                <Camera 
                  isActive={isCameraActive} 
                  activeMode={activeMode}
                  onCapture={handleCapture}
                  onHandResults={handleHandResults}
                />
              </div>
              
              {!(isCameraActive && activeMode === 'hand') && (
                <div className="text-center text-gray-500 text-sm mt-4">
                  <p>1. Start the camera. 2. Select Face Mesh or Hand Pose. 3. Capture a photo to edit with AI.</p>
                </div>
              )}
            </div>

            {/* Gesture Trainer Section - Side by Side on Large Screens */}
            {isCameraActive && activeMode === 'hand' && (
              <div className="w-full lg:w-[40%] lg:min-w-[420px]">
                <GestureTrainer handPoseDataRef={handPoseResultsRef} />
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
