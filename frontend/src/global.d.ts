declare global {
  interface Window {
    memoryMonitor?: unknown;
    leakDetector?: unknown;
    resourceManager?: unknown;
    appCache?: unknown;
    apiCache?: unknown;
    marketDataCache?: unknown;
    performanceMonitor?: unknown;
    addNotification?: (arg: { title: string; message: string }) => void;
  }
}
export {}; 