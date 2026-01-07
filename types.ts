
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

export interface ImageClassifierResult {
  label: string;
  confidence: number;
}

export interface ML5ImageClassifier {
  classify: (
    media: HTMLVideoElement | HTMLImageElement,
    callback: (results: ImageClassifierResult[]) => void
  ) => void;
  classifyStart: (
    media: HTMLVideoElement,
    callback: (results: ImageClassifierResult[]) => void
  ) => void;
  classifyStop: () => void;
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
    __TF_BACKEND_CONFIGURED__?: boolean;
    ml5: {
      faceMesh: (options?: any) => Promise<ML5Model>;
      handPose: (options?: any) => Promise<ML5Model>;
      bodyPose: (model?: 'MoveNet' | 'BlazePose', options?: any) => Promise<ML5Model>;
      imageClassifier: (modelNameOrUrl: string, options?: any) => Promise<ML5ImageClassifier>;
      neuralNetwork: (options?: NeuralNetworkOptions) => ML5NeuralNetwork;
      setBackend: (backend: 'webgl' | 'cpu' | 'webgpu') => Promise<void>;
    };
    tf?: {
      tidy: <T>(fn: () => T) => T;
      nextFrame: () => Promise<void>;
      disposeVariables?: () => void;
      setBackend: (backend: 'webgl' | 'cpu' | 'webgpu' | 'wasm') => Promise<boolean>;
      ready: () => Promise<void>;
      getBackend: () => string;
      env?: () => {
        set: (key: string, value: any) => void;
        get: (key: string) => any;
      };
      memory: () => {
        numTensors: number;
        numBytes: number;
        numDataBuffers: number;
      };
      engine: () => {
        startScope: () => void;
        endScope: () => void;
        backend?: any;
        backendNames: () => string[];
      };
      version?: {
        tfjs: string;
      };
    };
  }
}
