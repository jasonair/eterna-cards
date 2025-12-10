'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import type { Result } from '@zxing/library';

interface MobileBarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function MobileBarcodeScanner({ onScan, onClose }: MobileBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    const startScanner = async () => {
      if (!videoRef.current) {
        setInitializing(false);
        return;
      }

      try {
        const codeReader = new BrowserMultiFormatReader();

        const controls = await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _error, cbControls) => {
            if (!active) {
              return;
            }
            if (result) {
              const text = result.getText();
              if (text) {
                cbControls?.stop();
                controlsRef.current = null;
                onScan(text);
              }
            }
          },
        );

        controlsRef.current = controls;
        setError(null);
      } catch (e) {
        setError('Unable to access camera. Check browser permissions and use a mobile device.');
      } finally {
        setInitializing(false);
      }
    };

    startScanner();

    return () => {
      active = false;
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 sm:hidden">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <h2 className="text-sm font-semibold">Scan barcode</h2>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20"
        >
          Close
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-8 border-2 border-[#ff6b35] rounded-xl pointer-events-none" />
        </div>

        {initializing && !error && (
          <p className="mt-4 text-xs text-gray-200">Initializing camera…</p>
        )}
        {error && (
          <p className="mt-4 text-xs text-red-300 text-center max-w-xs">{error}</p>
        )}
        {!initializing && !error && (
          <p className="mt-3 text-[11px] text-gray-300 text-center max-w-xs">
            Align the barcode within the frame. Scanning will happen automatically.
          </p>
        )}
      </div>
    </div>
  );
}
