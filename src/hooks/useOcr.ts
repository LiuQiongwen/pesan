/**
 * useOcr — tesseract.js Worker wrapper
 * Status: idle → loading → recognizing → done | error
 */
import { useState, useRef, useCallback } from 'react';
import { createWorker, Worker as TessWorker } from 'tesseract.js';

export type OcrStatus = 'idle' | 'loading' | 'recognizing' | 'done' | 'error';

export interface OcrState {
  status: OcrStatus;
  progress: number;
  text: string;
  error: string | null;
}

export function useOcr() {
  const [state, setState] = useState<OcrState>({
    status: 'idle',
    progress: 0,
    text: '',
    error: null,
  });

  const workerRef = useRef<TessWorker | null>(null);

  const recognize = useCallback(async (image: File | Blob): Promise<string> => {
    setState({ status: 'loading', progress: 0, text: '', error: null });

    try {
      // Create worker with chi_sim + eng for Chinese + English
      const worker = await createWorker('chi_sim+eng', undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setState(prev => ({
              ...prev,
              status: 'recognizing',
              progress: Math.round(m.progress * 100) / 100,
            }));
          }
        },
      });
      workerRef.current = worker;

      setState(prev => ({ ...prev, status: 'recognizing', progress: 0 }));

      const { data } = await worker.recognize(image);
      const text = data.text.trim();

      await worker.terminate();
      workerRef.current = null;

      setState({ status: 'done', progress: 1, text, error: null });
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '识别失败';
      setState({ status: 'error', progress: 0, text: '', error: msg });
      throw e;
    }
  }, []);

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate().catch(() => {});
      workerRef.current = null;
    }
    setState({ status: 'idle', progress: 0, text: '', error: null });
  }, []);

  return { ...state, recognize, reset };
}
