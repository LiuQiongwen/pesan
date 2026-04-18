/**
 * useNfc — thin wrapper around Web NFC API (NDEFReader).
 * Only works on Chrome Android 89+ with HTTPS.
 * Returns supported=false on all other platforms.
 */
import { useState, useRef, useCallback } from 'react';

export function useNfc() {
  const supported = typeof window !== 'undefined' && 'NDEFReader' in window;
  const [scanning, setScanning] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
  }, []);

  const scan = useCallback(async (onRead: (url: string) => void) => {
    if (!supported) { setError('Web NFC is not supported on this device'); return; }
    setError(null);

    try {
      const NDEFReaderCtor = (window as unknown as Record<string, unknown>).NDEFReader as new () => NDEFReaderInstance;
      const reader = new NDEFReaderCtor();
      const ac = new AbortController();
      abortRef.current = ac;

      reader.onreading = (event: NDEFReadingEvent) => {
        for (const record of event.message.records) {
          if (record.recordType === 'url' || record.recordType === 'text') {
            const decoder = new TextDecoder();
            const text = decoder.decode(record.data);
            onRead(text);
            stop();
            return;
          }
        }
      };

      reader.onerror = () => {
        setError('NFC read error');
        stop();
      };

      await reader.scan({ signal: ac.signal });
      setScanning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'NFC permission denied';
      setError(msg.includes('not allowed') || msg.includes('permission') ? 'NFC permission denied' : msg);
      setScanning(false);
    }
  }, [supported, stop]);

  const write = useCallback(async (url: string) => {
    if (!supported) { setError('Web NFC is not supported on this device'); return; }
    setError(null);
    setWriting(true);

    try {
      const NDEFReaderCtor = (window as unknown as Record<string, unknown>).NDEFReader as new () => NDEFReaderInstance;
      const writer = new NDEFReaderCtor();
      await writer.write({ records: [{ recordType: 'url', data: url }] });
      setWriting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'NFC write failed';
      setError(msg);
      setWriting(false);
    }
  }, [supported]);

  return { supported, scanning, writing, error, scan, write, stop };
}

// Web NFC type stubs (not in standard TS libs)
interface NDEFRecord { recordType: string; data: ArrayBuffer; }
interface NDEFMessage { records: NDEFRecord[]; }
interface NDEFReadingEvent { message: NDEFMessage; }
interface NDEFReaderInstance {
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onerror: (() => void) | null;
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  write: (message: { records: { recordType: string; data: string }[] }) => Promise<void>;
}
