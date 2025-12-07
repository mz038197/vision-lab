
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

  // Handle Classification Loop - Sequential to prevent crashing
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const classify = () => {
      if (isCancelled) return;

      const currentData = handPoseDataRef.current;

      // Ensure we have a trained network and hand data
      if (isTrained && network && currentData.length > 0) {
        const input = getNormalizedHandVector(currentData[0]);
        if (input.length === 42) {
          try {
            // NOTE: We wait for the callback BEFORE scheduling the next classification.
            // This prevents "stacking" inference calls which crashes the browser.
            network.classify(input, (error: any, results: any[]) => {
              if (isCancelled) return;

              if (error) {
                console.error(error);
              } else if (results && results.length > 0) {
                setClassificationResult(results[0].label);
                setConfidence(results[0].confidence);
              }
              
              // Schedule next inference only after this one is done
              timerId = setTimeout(classify, 100);
            });
            return; // Exit here, let the callback schedule next
          } catch (e) {
            console.error("Classification error:", e);
          }
        }
      }
      
      // If no data or not trained, check again in 200ms
      timerId = setTimeout(classify, 200);
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
        // While training
        setTrainingLogs(prev => {
            // Optimization: Only keep last 100 logs
            return [{ epoch, loss }, ...prev].slice(0, 100);
        });
      },
      () => {
        // Finished training
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
    <div className="w-full max-w-5xl mx-auto mt-6 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
      
      {/* Left Panel: Configuration */}
      <div className="w-full md:w-1/3 bg-gray-800 p-6 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col gap-6">
        <div>
           <h3 className="text-xl font-bold text-white mb-2">Gesture Trainer</h3>
           <p className="text-sm text-gray-400">Define classes and train your custom hand gesture model.</p>
        </div>

        {/* Add Class */}
        <div className="space-y-2">
           <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add New Class</label>
           <div className="flex gap-2">
             <input 
               type="text" 
               value={newLabel}
               onChange={(e) => setNewLabel(e.target.value)}
               placeholder="e.g. Rock"
               className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
             />
             <button 
               onClick={addLabel}
               disabled={!newLabel}
               className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
             >
               Add
             </button>
           </div>
        </div>

        {/* Hyperparameters */}
        <div className="space-y-4">
           <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Training Settings</label>
           
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Epochs</label>
                <input 
                  type="number" 
                  value={epochs} 
                  onChange={(e) => setEpochs(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Batch Size</label>
                <input 
                  type="number" 
                  value={batchSize} 
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Learning Rate</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={learningRate} 
                  onChange={(e) => setLearningRate(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                />
              </div>
           </div>
        </div>
        
        <div className="flex flex-col gap-2 mt-auto">
             <button
               onClick={trainModel}
               disabled={labels.length < 2 || isTraining || Object.values(dataCounts).reduce((a: number, b: number) => a + b, 0) === 0}
               className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all ${
                 isTraining ? 'bg-gray-600 cursor-wait' : 
                 labels.length < 2 ? 'bg-gray-700 opacity-50 cursor-not-allowed' :
                 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/25'
               }`}
             >
               {isTraining ? 'Training...' : 'Train Model'}
             </button>
             
             {isTrained && (
               <button
                 onClick={saveModel}
                 className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
               >
                 Save Model
               </button>
             )}
        </div>
      </div>

      {/* Right Panel: Data Collection & Results */}
      <div className="flex-1 bg-gray-900 p-6 flex flex-col gap-6">
        
        {/* Classification Result Banner */}
        <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700 shadow-inner min-h-[120px] flex flex-col items-center justify-center">
           {isTrained ? (
              <>
                <p className="text-gray-400 text-sm mb-1">Prediction</p>
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
                  {classificationResult || "Waiting for hand..."}
                </h2>
                {classificationResult && (
                   <div className="mt-2 text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">
                     Confidence: {(confidence * 100).toFixed(1)}%
                   </div>
                )}
              </>
           ) : (
              <p className="text-gray-500 italic">Train the model to see predictions here.</p>
           )}
        </div>

        {/* Class List & Data Collection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {labels.length === 0 && (
             <div className="col-span-full text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">
               Add classes on the left to start collecting data.
             </div>
          )}
          {labels.map(label => (
            <div key={label} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700 hover:border-gray-600 transition-colors">
              <div>
                <span className="font-bold text-white block">{label}</span>
                <span className="text-xs text-indigo-400">{dataCounts[label] || 0} samples</span>
              </div>
              <button
                onClick={() => collectData(label)}
                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs px-3 py-2 rounded font-medium transition-colors flex items-center gap-1"
                disabled={isTraining}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Get Data
              </button>
            </div>
          ))}
        </div>

        {/* Training Logs */}
        {trainingLogs.length > 0 && (
          <div className="flex-1 bg-black rounded-lg p-4 font-mono text-xs text-green-400 overflow-y-auto border border-gray-800 max-h-48">
             <div className="flex justify-between border-b border-gray-800 pb-2 mb-2 text-gray-500">
               <span>Epoch</span>
               <span>Loss</span>
             </div>
             {trainingLogs.map((log, idx) => (
               <div key={idx} className="flex justify-between py-0.5">
                 <span>{log.epoch + 1}</span>
                 <span>{log.loss.toFixed(5)}</span>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GestureTrainer;
