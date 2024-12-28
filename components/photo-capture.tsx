'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X } from 'lucide-react'

interface PhotoCaptureProps {
  onPhotoCapture: (photoUrl: string) => void;
}

export function PhotoCapture({ onPhotoCapture }: PhotoCaptureProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoUrl = canvasRef.current.toDataURL('image/jpeg');
        onPhotoCapture(photoUrl);
        stopCamera();
        setShowCamera(false);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const photoUrl = reader.result as string;
        onPhotoCapture(photoUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost"
          className="h-12 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-black font-medium"
        >
          <Camera className="w-5 h-5 mr-2" />
          photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-black border-gray-800">
        <div className="flex flex-col gap-4">
          {!showCamera ? (
            <>
              <Button
                onClick={() => {
                  setShowCamera(true);
                  startCamera();
                }}
                className="h-12 bg-orange-500 hover:bg-orange-600 text-black"
              >
                <Camera className="w-5 h-5 mr-2" />
                Use Camera
              </Button>
              <div className="relative">
                <Button
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-black"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Photo
                </Button>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  onClick={capturePhoto}
                  className="h-12 w-12 rounded-full bg-white hover:bg-gray-200"
                >
                  <Camera className="w-6 h-6 text-black" />
                </Button>
                <Button
                  onClick={() => {
                    stopCamera();
                    setShowCamera(false);
                  }}
                  variant="destructive"
                  className="h-12 w-12 rounded-full"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

