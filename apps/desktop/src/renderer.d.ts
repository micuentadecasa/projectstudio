declare global {
  interface Window {
    studio: {
      phase: string;
      runtime: string;
      omp: string;
    };
  }
}

export {};
