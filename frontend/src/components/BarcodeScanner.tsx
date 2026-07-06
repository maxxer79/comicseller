import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/**
 * Camera barcode scanner (works on phones). Opens the rear camera and reads a
 * comic barcode. Comic barcodes are a 12-digit UPC-A plus a 5-digit add-on that
 * encodes issue/cover/printing, so the scanner PREFERS a full 17-digit read:
 * when it sees the 12-digit main code but not the add-on, it keeps scanning and
 * offers a "use main code only" fallback so nothing gets stuck.
 */
export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void }>();
  const acceptedRef = useRef(false);
  const [error, setError] = useState<string>();
  const [pendingMain, setPendingMain] = useState<string>();

  useEffect(() => {
    // Focus the decoder on UPC/EAN and ask it to also read the 2/5-digit add-on.
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_A, BarcodeFormat.EAN_13]);
    hints.set(DecodeHintType.ALLOWED_EAN_EXTENSIONS, [2, 5]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);

    // Higher-resolution rear camera makes the tiny add-on far more readable.
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };

    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result) => {
            if (acceptedRef.current || !result) return;
            const digits = result.getText().replace(/\D/g, "");
            if (digits.length >= 17) {
              acceptedRef.current = true;
              controls.stop();
              onDetected(digits);
            } else if (digits.length === 12) {
              // Keep scanning for the add-on, but remember the main code.
              setPendingMain((prev) => prev ?? digits);
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        setError(
          (e as Error).message ||
            "Could not access the camera. Check permissions and that you're on HTTPS or localhost."
        );
      }
    })();

    return () => {
      acceptedRef.current = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  function useMainOnly() {
    if (pendingMain && !acceptedRef.current) {
      acceptedRef.current = true;
      controlsRef.current?.stop();
      onDetected(pendingMain);
    }
  }

  return (
    <div className="scanner-overlay" onClick={onClose}>
      <div className="scanner-box" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-reticle">
          <video ref={videoRef} muted playsInline />
        </div>
        <div className="scanner-body">
          {error ? (
            <p className="error">{error}</p>
          ) : pendingMain ? (
            <p className="muted">
              Main code {pendingMain} read — hold steady to capture the issue
              add-on (the small barcode to its right)…
            </p>
          ) : (
            <p className="muted">Point the camera at the comic's barcode…</p>
          )}
          <div className="pill-row">
            {pendingMain && (
              <button onClick={useMainOnly}>Use main code only</button>
            )}
            <button className="secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
