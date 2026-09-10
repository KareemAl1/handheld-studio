/// <reference types="vite/client" />

interface Document {
  modelContext?: {
    registerTool(tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute(input: unknown): Promise<unknown>;
    }, options: { signal: AbortSignal }): void | Promise<void>;
  };
}

interface Window {
  __HS_STUDIO__?: {
    snapshot(): { frames: number; calls: number; triangles: number; geometries: number; textures: number; camera: number[]; zoom: { zoom: number; zoomGoal: number; fit: number; min: number; max: number }; materials: { shell: string; buttons: string; transmission: number }; dpr: number; renderer: string };
    beginMeasure(): void;
    endMeasure(): number[];
    poster(): string;
  };
}
