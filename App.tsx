
import React, { useState, useCallback, useRef } from 'react';
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

  const isHandMode = isCameraActive && activeMode === 'hand';

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col font-sans overflow-hidden">
      {/* Header - Fixed at top */}
      <header className="px-6 py-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md z-30 flex-none">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Vision Lab</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Gemini Nano & ml5.js</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-500 font-medium">
             <span>v1.0.0</span>
             <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
             <span>Powered by Google GenAI</span>
          </div>
        </div>
      </header>

      {/* Main Content Area - Dashboard Layout */}
      <main className="flex-1 w-full flex flex-col overflow-hidden">
        
        {/* Layout Container */}
        <div className={`flex-1 flex gap-6 p-4 md:p-6 overflow-hidden ${isHandMode ? 'flex-col lg:flex-row' : 'flex-col items-center justify-center'}`}>
             
           {/* Left/Main Panel: Camera */}
           <div className={`flex flex-col gap-4 min-w-0 transition-all duration-500 ${isHandMode ? 'flex-1 h-full' : 'w-full max-w-5xl h-auto'}`}>
              
              {/* Control Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-900/50 p-2 rounded-2xl border border-gray-800 backdrop-blur-sm w-full shrink-0">
                 
                 {/* Camera Toggle */}
                 <button
                   onClick={toggleCamera}
                   className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm transform active:scale-95 text-sm ${
                     isCameraActive 
                       ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
                       : 'bg-indigo-600 text-white border border-transparent hover:bg-indigo-500 hover:shadow-indigo-500/25'
                   }`}
                 >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {isCameraActive 
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      }
                   </svg>
                   {isCameraActive ? 'Stop' : 'Start Camera'}
                 </button>

                 {/* Mode Selectors */}
                 <div className="flex bg-gray-800/80 rounded-xl p-1 border border-gray-700 w-full sm:w-auto overflow-x-auto">
                   {['none', 'face', 'hand'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                            setActiveMode(mode as any);
                            if (mode !== 'hand') handPoseResultsRef.current = [];
                        }}
                        disabled={!isCameraActive}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
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

              {/* Camera Viewport Container */}
              <div className={`relative bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl group ${isHandMode ? 'flex-1 min-h-0' : 'w-full aspect-video'}`}>
                 <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-white/10 rounded-tl-2xl z-20 pointer-events-none group-hover:border-indigo-500/50 transition-colors"></div>
                 <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-white/10 rounded-tr-2xl z-20 pointer-events-none group-hover:border-indigo-500/50 transition-colors"></div>
                 <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-white/10 rounded-bl-2xl z-20 pointer-events-none group-hover:border-indigo-500/50 transition-colors"></div>
                 <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-white/10 rounded-br-2xl z-20 pointer-events-none group-hover:border-indigo-500/50 transition-colors"></div>

                 <div className="w-full h-full">
                     <Camera 
                       isActive={isCameraActive} 
                       activeMode={activeMode}
                       onCapture={handleCapture}
                       onHandResults={handleHandResults}
                     />
                 </div>
              </div>
              
              {/* Helper Text */}
              {!isHandMode && (
                <div className="text-center w-full text-gray-500 text-sm mt-4">
                   <p>Select <span className="text-indigo-400 font-medium">Face Mesh</span> or <span className="text-indigo-400 font-medium">Hand Pose</span> to begin.</p>
                </div>
              )}
           </div>

           {/* Right Panel: Gesture Trainer (Conditionally Rendered) */}
           {isHandMode && (
              <div className="w-full lg:w-[420px] xl:w-[480px] shrink-0 h-full overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                 <GestureTrainer handPoseDataRef={handPoseResultsRef} />
              </div>
           )}

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