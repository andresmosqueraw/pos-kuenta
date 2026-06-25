declare module 'qz-tray' {
  const qz: {
    websocket: {
      connect: (options?: { retries?: number; delay?: number }) => Promise<void>;
      disconnect: () => Promise<void>;
      isActive: () => boolean;
    };
    security: {
      setCertificatePromise: (fn: (resolve: (v: string) => void, reject: (e: unknown) => void) => void) => void;
      setSignatureAlgorithm: (algo: string) => void;
      setSignaturePromise: (fn: (toSign: string) => (resolve: (v: string) => void, reject: (e: unknown) => void) => void) => void;
    };
    printers: {
      find: (query?: string) => Promise<string[]>;
    };
    configs: {
      create: (printer: string, options?: Record<string, unknown>) => unknown;
    };
    print: (config: unknown, data: Array<{ type: string; format: string; data: string }>) => Promise<void>;
  };
  export default qz;
}
