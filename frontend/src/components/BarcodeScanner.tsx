import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

/**
 * Camera barcode scanner (works on phones). Opens the rear camera, reads a
 * UPC/EAN, and calls onDetected with the digits. Uses @zxing/browser which
 * works across Chrome, Safari (iOS 11+), and Android.
 */
export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopFn: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined, // default = rear camera on phones
          videoRef.current!,
          (result, _err, controls) => {
            if (result && !cancelled) {
              cancelled = true;
              controls.stop();
              onDetected(result.getText());
            }
          }
        );
        stopFn = () => controls.stop();
      } catch (e) {
        setError(
          (e as Error).message ||
            "Could not access the camera. Check permissions and that you're on HTTPS or localhost."
        );
      }
    })();

    return () => {
      cancelled = true;
      stopFn?.();
    };
  }, [onDetected]);

  return (
    <div className="scanner-overlay" onClick={onClose}>
      <div className="scanner-box" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-reticle">
          <video ref={videoRef} muted playsInline />
        </div>
        <div className="scanner-body">
          {error ? (
            <p className="error">{error}</p>
          ) : (
            <p className="muted">Point the camera at the comic's barcode…</p>
          )}
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
