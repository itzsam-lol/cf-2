'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import jsQR from 'jsqr';
import { toast } from 'sonner';

interface PickupScannerModalProps {
  onClose: () => void;
  onReleased: (itemTitle: string) => void;
}

export default function PickupScannerModal({ onClose, onReleased }: PickupScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleScannedToken = async (token: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/claims/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || 'This code could not be verified.');
        // Allow re-scanning after a brief cooldown rather than locking the modal up.
        setTimeout(() => {
          submittingRef.current = false;
          setVerifying(false);
        }, 2000);
        return;
      }

      toast.success(`Item released: ${data.itemTitle}`);
      onReleased(data.itemTitle);
    } catch (err) {
      console.error(err);
      setError('Network error while verifying the code. Try again.');
      setTimeout(() => {
        submittingRef.current = false;
        setVerifying(false);
      }, 2000);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLoop();
      } catch (err) {
        console.error(err);
        setError('Camera access was denied or is unavailable. Grant camera permissions and try again.');
      }
    }

    function scanLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      if (video.readyState === video.HAVE_ENOUGH_DATA && !submittingRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            void handleScannedToken(code.data);
          }
        }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-on-background/60 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm bg-surface rounded-xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant z-10"
      >
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Camera size={20} className="text-primary" />
            Scan to Release
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-critical p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center bg-surface-bright gap-4">
          <p className="text-sm text-on-surface-variant text-center">
            Point the camera at the claimant&apos;s pickup QR code to verify and release the item.
          </p>

          <div className="relative w-64 h-64 bg-black rounded-lg overflow-hidden border-2 border-primary/20">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-6 border-2 border-success/70 rounded-lg pointer-events-none"></div>
            {verifying && (
              <div className="absolute inset-0 bg-on-background/50 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={32} />
              </div>
            )}
          </div>

          {error ? (
            <div className="w-full flex items-start gap-2 bg-error/10 border border-error/20 text-error rounded-lg p-3 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 bg-primary-fixed py-2.5 px-4 rounded-lg">
              <ShieldCheck size={18} className="text-primary" />
              <span className="text-sm font-medium text-primary">Awaiting valid pickup code…</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
