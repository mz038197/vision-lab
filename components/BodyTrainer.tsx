
import React, { useEffect, useState, useRef } from 'react';
import { ML5NeuralNetwork, BodyPosePrediction } from '../types';
import { getNormalizedBodyVector } from '../utils/bodyUtils';
import TrainingChart from './TrainingChart';

interface BodyTrainerProps {
  bodyPoseDataRef: React.MutableRefObject<BodyPosePrediction[]>;
  onClassificationResult?: (result: string) => void;
}

const BodyTrainer: React.FC<BodyTrainerProps> = ({ bodyPoseDataRef, onClassificationResult }) => {
  const [network, setNetwork] = useState<ML5NeuralNetwork | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [trainingLogs, setTrainingLogs] = useState<{ epoch: number; loss: number }[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [classificationResult, setClassificationResult] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  
  // Training Hyperparameters
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(12);
  const [learningRate, setLearningRate] = useState(0.2);

  // Stats tracking
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({});
  
  // File input ref for loading model
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Store raw training data for CSV export
  const trainingDataRef = useRef<Array<{ inputs: number[], label: string }>>([]);

  useEffect(() => {
    const initNetwork = () => {
      if (window.ml5) {
        const nn = window.ml5.neuralNetwork({
          task: 'classification',
          debug: false,
          inputs: 34, // 17 keypoints * 2 (x, y)
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

      const currentData = bodyPoseDataRef.current;

      // Ensure we have a trained network and body data
      if (isTrained && network && currentData.length > 0) {
        const input = getNormalizedBodyVector(currentData[0]);
        if (input.length === 34) {
          try {
            // NOTE: We wait for the callback BEFORE scheduling the next classification.
            // This prevents "stacking" inference calls which crashes the browser.
            network.classify(input, (results: any) => {
              if (isCancelled) return;

              // ml5 v1: callback receives results directly (not error, results)
              if (results && Array.isArray(results) && results.length > 0) {
                // Format: [{ label: 'Standing', confidence: 0.99 }, ...]
                const topResult = results[0];
                const label = topResult.label ?? '';
                const confidence = topResult.confidence ?? 0;
                
                setClassificationResult(label);
                setConfidence(confidence);
                
                // Pass result to parent component
                if (onClassificationResult) {
                  onClassificationResult(label);
                }
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
  }, [isTrained, network, bodyPoseDataRef]); 

  const addLabel = () => {
    if (newLabel && !labels.includes(newLabel)) {
      setLabels([...labels, newLabel]);
      setDataCounts(prev => ({ ...prev, [newLabel]: 0 }));
      setNewLabel('');
    }
  };

  const collectData = (label: string) => {
    if (!network || bodyPoseDataRef.current.length === 0) return;

    const inputs = getNormalizedBodyVector(bodyPoseDataRef.current[0]);
    if (inputs.length === 34) {
      const target = { label };
      network.addData(inputs, target);
      
      // Store for CSV export
      trainingDataRef.current.push({ inputs, label });
      
      setDataCounts(prev => ({
        ...prev,
        [label]: (prev[label] || 0) + 1
      }));
    }
  };

  const trainModel = async () => {
    if (!network) return;
    
    // Check if we have enough data
    const totalSamples = Object.values(dataCounts).reduce((a, b) => (a as number) + (b as number), 0) as number;
    if (totalSamples < 2) {
      alert("Please collect at least 2 data samples before training.");
      return;
    }
    
    setIsTraining(true);
    setTrainingLogs([]);
    setIsTrained(false);

    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      try {
        network.normalizeData();

        const trainingOptions = {
          epochs,
          batchSize,
          learningRate
        };

        network.train(
          trainingOptions,
          (epoch: number, logs: { loss?: number; acc?: number }) => {
            try {
              // ml5 v1 format: (epoch, { acc, loss, val_acc, val_loss })
              const loss = logs?.loss ?? 0;
              
              setTrainingLogs(prev => {
                  return [{ epoch, loss }, ...prev].slice(0, 100);
              });
            } catch (e) {
              console.warn("Error in training callback:", e);
            }
          },
          () => {
            // Finished training
            setIsTraining(false);
            setIsTrained(true);
          }
        );
      } catch (error) {
        console.error("Training error:", error);
        setIsTraining(false);
        alert("Training failed. Please collect more varied data samples and try again.");
      }
    }, 100);
  };

  const saveModel = () => {
    if (network) {
      const name = prompt("Enter model name (will trigger download):", "my-body-pose-model");
      if (name) {
         network.save(name);
      }
    }
  };

  const handleLoadModel = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // ml5 neuralNetwork expects: model.json, model_meta.json, model.weights.bin
    const fileArray: File[] = Array.from(files);
    
    // Check if we have the required files
    const jsonFile = fileArray.find(f => f.name.endsWith('model.json') && !f.name.includes('meta'));
    const metaFile = fileArray.find(f => f.name.includes('model_meta.json'));
    const weightsFile = fileArray.find(f => f.name.endsWith('.weights.bin'));

    if (!jsonFile || !metaFile || !weightsFile) {
      alert("Please select all 3 model files: model.json, model_meta.json, and model.weights.bin");
      return;
    }

    setIsLoading(true);
    
    try {
      // Create a new neural network for loading
      const nn = window.ml5.neuralNetwork({
        task: 'classification',
        debug: false,
      });

      // Create object URLs for the files
      const modelInfo = {
        model: URL.createObjectURL(jsonFile as Blob),
        metadata: URL.createObjectURL(metaFile as Blob),
        weights: URL.createObjectURL(weightsFile as Blob),
      };

      // Load the model
      nn.load(modelInfo, () => {
        setNetwork(nn);
        setIsTrained(true);
        setIsLoading(false);
        setLabels([]); // Clear labels since we don't know them from loaded model
        setDataCounts({});
        setTrainingLogs([]);
        
        // Revoke object URLs to free memory
        URL.revokeObjectURL(modelInfo.model);
        URL.revokeObjectURL(modelInfo.metadata);
        URL.revokeObjectURL(modelInfo.weights);
        
        alert("Model loaded successfully! You can now make predictions.");
      });
    } catch (error) {
      console.error("Error loading model:", error);
      setIsLoading(false);
      alert("Failed to load model. Please check the files and try again.");
    }

    // Reset file input
    e.target.value = '';
  };

  const exportCSV = () => {
    if (trainingDataRef.current.length === 0) {
      alert("No training data to export!");
      return;
    }

    // Create CSV content
    const headers = ['label', ...Array.from({ length: 34 }, (_, i) => `feature_${i + 1}`)];
    const csvRows = [headers.join(',')];

    trainingDataRef.current.forEach(({ inputs, label }) => {
      const row = [label, ...inputs.map(v => v.toFixed(6))];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `body-pose-training-data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = () => {
    csvInputRef.current?.click();
  };

  const onCSVSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvContent = event.target?.result as string;
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          alert("CSV file is empty or invalid!");
          return;
        }

        // Skip header
        const dataLines = lines.slice(1);
        
        // Clear existing data
        trainingDataRef.current = [];
        const newDataCounts: Record<string, number> = {};
        const newLabels = new Set<string>();

        // Parse and add data
        dataLines.forEach(line => {
          const values = line.split(',');
          if (values.length < 2) return;

          const label = values[0].trim();
          const inputs = values.slice(1).map(v => parseFloat(v));

          if (label && inputs.length === 34 && inputs.every(v => !isNaN(v))) {
            trainingDataRef.current.push({ inputs, label });
            newLabels.add(label);
            newDataCounts[label] = (newDataCounts[label] || 0) + 1;

            // Add to network
            if (network) {
              network.addData(inputs, { label });
            }
          }
        });

        // Update state
        setLabels(Array.from(newLabels));
        setDataCounts(newDataCounts);
        setIsTrained(false);
        
        alert(`Successfully imported ${trainingDataRef.current.length} samples from ${newLabels.size} classes!`);
      } catch (error) {
        console.error("Error importing CSV:", error);
        alert("Failed to import CSV file. Please check the file format.");
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[calc(100vh-180px)]">
      
      {/* Header with Prediction Result */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">Body Pose Trainer</h3>
          {isTrained && (
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">Model Ready</span>
          )}
        </div>
        
        {/* Prediction Banner */}
        <div className="bg-gray-900 rounded-lg p-4 text-center border border-gray-700">
          {isTrained ? (
            <>
              <p className="text-gray-500 text-xs mb-1">Prediction</p>
              <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
                {classificationResult || "Waiting..."}
              </h2>
              {classificationResult && (
                <div className="mt-1 text-xs text-gray-500">
                  Confidence: {(confidence * 100).toFixed(1)}%
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-sm italic">Train or load a model to see predictions</p>
          )}
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Add Class */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add New Class</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Standing"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={addLabel}
              disabled={!newLabel}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Add
            </button>
          </div>
        </div>

        {/* Class List & Data Collection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Classes ({labels.length})</label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {labels.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
                Add classes above to start
              </div>
            ) : (
              labels.map(label => (
                <div key={label} className="bg-gray-800 rounded-lg p-2 flex items-center justify-between border border-gray-700">
                  <div>
                    <span className="font-medium text-white text-sm">{label}</span>
                    <span className="text-xs text-indigo-400 ml-2">({dataCounts[label] || 0})</span>
                  </div>
                  <button
                    onClick={() => collectData(label)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded font-medium transition-colors"
                    disabled={isTraining}
                  >
                    + Data
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Training Settings - Collapsible */}
        <details className="group">
          <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer flex items-center gap-2">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Training Settings
          </summary>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div>
              <label className="text-xs text-gray-500">Epochs</label>
              <input 
                type="number" 
                value={epochs} 
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Batch</label>
              <input 
                type="number" 
                value={batchSize} 
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">LR</label>
              <input 
                type="number" 
                step="0.01"
                value={learningRate} 
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
              />
            </div>
          </div>
        </details>

        {/* Training Chart */}
        {trainingLogs.length > 0 && (
          <TrainingChart trainingLogs={trainingLogs} maxEpochs={epochs} />
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-700 bg-gray-800 space-y-2">
        <button
          onClick={trainModel}
          disabled={labels.length < 2 || isTraining || isLoading || Object.values(dataCounts).reduce((a: number, b: number) => a + b, 0) === 0}
          className={`w-full py-2.5 rounded-lg font-bold text-white transition-all text-sm ${
            isTraining ? 'bg-gray-600 cursor-wait' : 
            labels.length < 2 ? 'bg-gray-700 opacity-50 cursor-not-allowed' :
            'bg-green-600 hover:bg-green-500'
          }`}
        >
          {isTraining ? 'Training...' : 'Train Model'}
        </button>
        
        <div className="flex gap-2">
          {isTrained && (
            <button
              onClick={saveModel}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Save
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.bin"
            onChange={onFileSelected}
            className="hidden"
          />
          <button
            onClick={handleLoadModel}
            disabled={isTraining || isLoading}
            className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors text-sm flex items-center justify-center gap-1 ${
              isLoading ? 'bg-gray-600 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {isLoading ? 'Loading...' : 'Load'}
          </button>
        </div>

        {/* CSV Import/Export */}
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={trainingDataRef.current.length === 0}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={onCSVSelected}
            className="hidden"
          />
          <button
            onClick={handleImportCSV}
            disabled={isTraining || isLoading}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default BodyTrainer;

