import React, { useState } from 'react';
import { editImageWithGemini } from '../services/gemini';

interface EditorProps {
  imageData: string | null;
  onClose: () => void;
}

const Editor: React.FC<EditorProps> = ({ imageData, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(imageData);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!currentImage || !prompt.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await editImageWithGemini(currentImage, prompt);
      if (result) {
        setCurrentImage(result);
        setPrompt(''); // Clear prompt after success
      } else {
        setError("Failed to generate an edited image. The model might have refused the request.");
      }
    } catch (err) {
      setError("An error occurred while communicating with the AI service.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (currentImage) {
      const link = document.createElement('a');
      link.href = currentImage;
      link.download = `gemini-edit-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!imageData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[80vh]">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-red-500/80 rounded-full text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image Display Area */}
        <div className="flex-1 bg-black flex items-center justify-center p-4 relative overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
             {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>
            
            {currentImage && (
              <img 
                src={currentImage} 
                alt="Captured or Edited" 
                className="max-w-full max-h-full object-contain rounded-md shadow-lg border border-gray-800"
              />
            )}
            
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white space-y-4">
                 <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="animate-pulse font-medium text-indigo-300">Gemini is dreaming...</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-full md:w-80 bg-gray-800 border-l border-gray-700 flex flex-col p-6 space-y-6 overflow-y-auto">
          <div>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <span className="text-indigo-400">AI</span> Editor
            </h2>
            <p className="text-gray-400 text-sm">Powered by Gemini 2.5 Flash Image</p>
          </div>

          <div className="flex-1 space-y-4">
             <div className="space-y-2">
               <label className="text-sm font-medium text-gray-300 uppercase tracking-wider">Prompt</label>
               <textarea
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder="e.g., 'Add cyberpunk neon lights', 'Turn into a sketch'..."
                 className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-32 transition-all"
                 disabled={isProcessing}
               />
             </div>

             {error && (
               <div className="bg-red-900/30 border border-red-800 text-red-200 text-sm p-3 rounded-lg">
                 {error}
               </div>
             )}

             <button
               onClick={handleEdit}
               disabled={!prompt.trim() || isProcessing}
               className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
             >
               {isProcessing ? 'Generating...' : 'Generate Edit'}
             </button>
          </div>

          <div className="pt-6 border-t border-gray-700 space-y-3">
             <button
               onClick={handleDownload}
               className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
             >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
               </svg>
               Download Image
             </button>
             
             <button
                onClick={() => setCurrentImage(imageData)}
                className="w-full py-2 px-4 text-gray-400 hover:text-white text-sm hover:underline"
             >
               Reset to Original
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
