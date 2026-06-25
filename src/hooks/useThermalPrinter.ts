'use client';

import type { PrintData } from '@/libs/escpos';

import { useCallback, useRef } from 'react';
import { buildReceipt, toBase64 } from '@/libs/escpos';

export type PrintResult
  = | { ok: true }
    | { ok: false; reason: 'not-installed' | 'no-printer' | 'error'; message?: string };

export function useThermalPrinter() {
  const qzRef = useRef<any>(null);

  const getQZ = useCallback(async () => {
    if (qzRef.current) {
      return qzRef.current;
    }
    const qz = (await import('qz-tray')).default;

    qz.security.setCertificatePromise((_resolve: (v: string) => void, reject: (e: unknown) => void) =>
      fetch('/api/qz-cert')
        .then(r => r.text())
        .then(_resolve)
        .catch(reject),
    );

    qz.security.setSignatureAlgorithm('SHA512');
    qz.security.setSignaturePromise((toSign: string) => (resolve: (v: string) => void, reject: (e: unknown) => void) =>
      fetch('/api/qz-sign', { method: 'POST', body: toSign })
        .then(r => r.text())
        .then(resolve)
        .catch(reject),
    );

    qzRef.current = qz;
    return qz;
  }, []);

  const print = useCallback(async (data: PrintData): Promise<PrintResult> => {
    try {
      const qz = await getQZ();

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({ retries: 1, delay: 0 });
      }

      const printers: string[] = await qz.printers.find();

      const thermalPrinter
        = printers.find(p => /thermal|receipt|pos|rpt|star|epson|bixolon|citizen/i.test(p))
          ?? printers[0]
          ?? '\\\\.\\USB001'; // fallback: Windows USB raw / Linux ignora esto

      const config = qz.configs.create(thermalPrinter, { raw: true });
      const receipt = buildReceipt(data);

      await qz.print(config, [{ type: 'raw', format: 'base64', data: toBase64(receipt) }]);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Unable to establish') || msg.includes('WebSocket')) {
        return { ok: false, reason: 'not-installed' };
      }
      return { ok: false, reason: 'error', message: msg };
    }
  }, [getQZ]);

  return { print };
}
