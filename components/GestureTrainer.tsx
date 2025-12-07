
import React, { useEffect, useState, useRef } from 'react';
import { ML5NeuralNetwork, HandPosePrediction } from '../types';
import { getNormalizedHandVector } from '../utils/handUtils';

interface GestureTrainerProps {
  handPoseDataRef: React.MutableRefObject<HandPosePrediction[]>;
}

const GestureTrainer: React.FC<GestureTrainerProps> = ({ handPoseDataRef }) => {
  const [network, setNetwork] = useState<ML5NeuralNetwork | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [trainingLogs, setTrainingLogs] = useState<{ epoch: number; loss: number }[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [classificationResult, setClassificationResult] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  
  // Training Hyperparameters
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(12);
  const [learningRate, setLearningRate] = useState(0.2);

  // Stats tracking
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const initNetwork = () => {
      if (window.ml5) {
        const nn = window.ml5.neuralNetwork({
          task: 'classification',
          debug: false,
          inputs: 42, // 21 keypoints * 2 (x, y)
        });
        setNetwork(nn);
      }
    };
    initNetwork();
  }, []);

  // Handle Classification Loop - Sequential
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const classify = () => {
      if (isCancelled) return;

      const currentData = handPoseDataRef.current;

      if (isTrained && network && currentData.length > 0) {
        const input = getNormalizedHandVector(currentData[0]);
        if (input.length === 42) {
          try {
            network.classify(input, (error: any, results: any[]) => {
              if (isCancelled) return;

              if (error) {
                console.error(error);
              } else if (results && results.length > 0) {
                setClassificationResult(results[0].label);
                setConfidence(results[0].confidence);
              }
              
              // Throttle classification to ~5fps (200ms) to prevent GPU overload/crash
              timerId = setTimeout(classify, 200);
            });
            return;
          } catch (e) {
            console.error("Classification error:", e);
          }
        }
      }
      
      // If not trained or no hand detected, check again in 300ms
      timerId = setTimeout(classify, 300);
    };

    if (isTrained) {
      classify();
    }

    return () => {
      isCancelled = true;
      clearTimeout(timerId);
    };
  }, [isTrained, network, handPoseDataRef]); 

  const addLabel = () => {
    if (newLabel && !labels.includes(newLabel)) {
      setLabels([...labels, newLabel]);
      setDataCounts(prev => ({ ...prev, [newLabel]: 0 }));
      setNewLabel('');
    }
  };

  const collectData = (label: string) => {
    if (!network || handPoseDataRef.current.length === 0) return;

    const inputs = getNormalizedHandVector(handPoseDataRef.current[0]);
    if (inputs.length === 42) {
      const target = { label };
      network.addData(inputs, target);
      
      setDataCounts(prev => ({
        ...prev,
        [label]: (prev[label] || 0) + 1
      }));
    }
  };

  const trainModel = () => {
    if (!network) return;
    
    setIsTraining(true);
    setTrainingLogs([]);
    setIsTrained(false);

    network.normalizeData();

    const trainingOptions = {
      epochs,
      batchSize,
      learningRate
    };

    network.train(
      trainingOptions,
      (epoch, loss) => {
        setTrainingLogs(prev => [{ epoch, loss }, ...prev].slice(0, 100));
      },
      () => {
        setIsTraining(false);
        setIsTrained(true);
        console.log('Model trained!');
      }
    );
  };

  const saveModel = () => {
    if (network) {
      const name = prompt("Enter model name (will trigger download):", "my-hand-pose-model");
      if (name) {
         network.save(name);
      }
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      
      {/* Configuration Header */}
      <div className="bg-gray-800/80 p-5 border-b border-gray-700 backdrop-blur-sm shrink-0">
         <h3 className="text-lg font-bold text-white flex items-center gap-2">
           <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
           </svg>
           Gesture Trainer
         </h3>
         <p className="text-xs text-gray-400 mt-1">Define classes & train your model</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
        
        {/* Step 1: Add Classes */}
        <div className="space-y-3">
           <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
             1. Add Classes
           </label>
           <div className="flex gap-2">
             <input 
               type="text" 
               value={newLabel}
               onChange={(e) => setNewLabel(e.target.value)}
               placeholder="e.g. Rock, Paper..."
               className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
             />
             <button 
               onClick={addLabel}
               disabled={!newLabel}
               className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
             >
               Add
             </button>
           </div>
        </div>

        {/* Step 2: Collect Data */}
        {labels.length > 0 && (
          <div className="space-y-3">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
               2. Collect Data
             </label>
             <div className="space-y-2 bg-black/20 rounded-xl p-2">
                {labels.map(label => (
                  <div key={label} className="bg-gray-800 rounded-lg p-2 flex items-center justify-between border border-gray-700/50 hover:border-gray-600 transition-colors group">
                    <div className="flex flex-col px-1">
                      <span className="font-medium text-gray-200 text-sm">{label}</span>
                      <span className="text-[10px] text-gray-500 group-hover:text-indigo-400 transition-colors">{dataCounts[label] || 0} samples</span>
                    </div>
                    <button
                      onClick={() => collectData(label)}
                      disabled={isTraining}
                      className="bg-gray-700 hover:bg-indigo-600 text-white p-2 rounded-md transition-colors"
                      title="Collect Data"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Step 3: Train */}
        <div className="space-y-3">
           <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
             3. Train Model
           </label>
           
           <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
                <span className="text-[10px] text-gray-500 block mb-1">Epochs</span>
                <input 
                  type="number" 
                  value={epochs} 
                  onChange={(e) => setEpochs(Number(e.target.value))}
                  className="w-full bg-transparent border-none p-0 text-white text-sm focus:ring-0"
                />
              </div>
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
                <span className="text-[10px] text-gray-500 block mb-1">Learn Rate</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={learningRate} 
                  onChange={(e) => setLearningRate(Number(e.target.value))}
                  className="w-full bg-transparent border-none p-0 text-white text-sm focus:ring-0"
                />
              </div>
           </div>

           <button
             onClick={trainModel}
             disabled={labels.length < 2 || isTraining || Object.values(dataCounts).reduce((a: number, b: number) => a + b, 0) === 0}
             className={`w-full py-2.5 rounded-lg font-bold text-sm text-white shadow-lg transition-all ${
               isTraining ? 'bg-gray-600 cursor-wait' : 
               labels.length < 2 ? 'bg-gray-700 opacity-50 cursor-not-allowed' :
               'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
             }`}
           >
             {isTraining ? 'Training Model...' : 'Start Training'}
           </button>
        </div>

        {/* Step 4: Results & Prediction */}
        {(isTrained || trainingLogs.length > 0) && (
          <div className="space-y-3 pt-2 border-t border-gray-700/50">
             
             {/* Prediction Display */}
             {isTrained && (
               <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-xl p-4 text-center border border-indigo-500/30">
                  <p className="text-[10px] text-indigo-300 uppercase tracking-widest mb-1">Detected Gesture</p>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                    {classificationResult || "..."}
                  </h2>
                  {classificationResult && (
                     <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/30 border border-white/10">
                       <div className={`w-1.5 h-1.5 rounded-full ${confidence > 0.8 ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                       <span className="text-xs text-gray-300">{(confidence * 100).toFixed(0)}%</span>
                     </div>
                  )}
                  <button
                   onClick={saveModel}
                   className="mt-3 text-xs text-indigo-300 hover:text-white underline decoration-dashed underline-offset-2"
                  >
                   Download Model
                  </button>
               </div>
             )}

             {/* Loss Chart */}
             {trainingLogs.length > 0 && !isTrained && (
               <div className="bg-black/40 rounded-lg p-3 border border-gray-800">
                  <p className="text-[10px] text-gray-500 mb-2">Training Loss</p>
                  <div className="h-20 flex items-end gap-0.5 opacity-80">
                     {trainingLogs.map((log, i) => (
                       <div 
                         key={i} 
                         style={{ height: `${Math.min(100, Math.max(5, log.loss * 50))}%` }} 
                         className="flex-1 bg-green-500/50 rounded-t-sm"
                       ></div>
                     ))}
                  </div>
               </div>
             )}
          </div>
        )}

      </div>
    </div>
  );
};

export default GestureTrainer;