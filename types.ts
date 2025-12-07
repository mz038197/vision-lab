
export interface FaceMeshKeypoint {
  x: number;
  y: number;
  z?: number;
  name?: string;
}

export interface FaceMeshPrediction {
  keypoints: FaceMeshKeypoint[];
  box?: {
    width: number;
    height: number;
    xMax: number;
    xMin: number;
    yMax: number;
    yMin: number;
  };
}

export interface HandPoseKeypoint {
  x: number;
  y: number;
  name?: string;
}

export interface HandPosePrediction {
  keypoints: HandPoseKeypoint[];
  score: number;
  handedness: "Left" | "Right";
}

export interface BodyPoseKeypoint {
  x: number;
  y: number;
  confidence: number;
  name?: string;
}

export interface BodyPosePrediction {
  keypoints: BodyPoseKeypoint[];
  score?: number;
  box?: {
    width: number;
    height: number;
    xMax: number;
    xMin: number;
    yMax: number;
    yMin: number;
  };
}

export interface ML5Model {
  detectStart: (
    media: HTMLVideoElement, 
    callback: (results: any[]) => void
  ) => void;
  detectStop: () => void;
}

export interface NeuralNetworkOptions {
  task?: 'classification' | 'regression' | 'imageClassification';
  inputs?: number | any[];
  outputs?: number | any[];
  debug?: boolean;
  layers?: any[];
}

export interface TrainingOptions {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
}

export interface ML5NeuralNetwork {
  addData: (inputs: number[] | any, outputs: any[] | any) => void;
  normalizeData: () => void;
  train: (
    options: TrainingOptions, 
    whileTraining: (epochOrLogs: any, loss?: number) => void, 
    finishedTraining: () => void
  ) => void;
  classify: (inputs: number[] | any, callback: (results: any[]) => void) => void;
  save: (name?: string) => void;
  load: (filesOrPath: any, callback?: () => void) => void;
}

declare global {
  interface Window {
    ml5: {
      faceMesh: (options?: any) => Promise<ML5Model>;
      handPose: (options?: any) => Promise<ML5Model>;
      bodyPose: (model?: 'MoveNet' | 'BlazePose', options?: any) => Promise<ML5Model>;
      neuralNetwork: (options?: NeuralNetworkOptions) => ML5NeuralNetwork;
      setBackend: (backend: 'webgl' | 'cpu' | 'webgpu') => Promise<void>;
    };
  }
}
