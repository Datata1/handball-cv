import { Upload, Video, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { motion } from 'motion/react';

interface UploadResponse {
  match_id: string;
  filename: string;
  status: string;
  message: string;
}

interface VideoUploadProps {
  onVideoUpload: (file: File, matchId: string) => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export function VideoUpload({ onVideoUpload }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [annotateVideo, setAnnotateVideo] = useState(false);

  const uploadToBackend = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    console.log("DEBUG: Starting upload, file:", file.name, "size:", file.size);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('annotate_video', annotateVideo ? 'true' : 'false');
      console.log("DEBUG: FormData created, file in formData:", formData.get('file'));

      const response = await fetch(`${BACKEND_URL}/api/v1/videos/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log("DEBUG: Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.status}`);
      }

      const data: UploadResponse = await response.json();
      console.log("DEBUG: Upload response:", data);
      
      // Pass file and match_id to parent
      onVideoUpload(file, data.match_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(message);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  }, [onVideoUpload, annotateVideo]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      uploadToBackend(videoFile);
    }
  }, [uploadToBackend]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadToBackend(file);
    }
  }, [uploadToBackend]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        className={`p-12 border-2 border-dashed transition-all ${
          isDragging 
            ? 'border-sky-500 bg-gradient-to-br from-sky-50 to-orange-50 shadow-xl' 
            : 'border-gray-300 hover:border-sky-500 hover:shadow-lg'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <motion.div 
            className={`p-6 rounded-full ${isDragging ? 'bg-gradient-to-br from-sky-500 to-orange-500' : 'bg-gradient-to-br from-sky-100 to-blue-100'}`}
            animate={{ 
              scale: isDragging ? 1.1 : 1,
              rotate: isDragging ? 5 : 0 
            }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Upload className={`w-12 h-12 ${isDragging ? 'text-white' : 'text-sky-700'}`} />
          </motion.div>
          
          <div>
            <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-blue-900 to-orange-600 bg-clip-text text-transparent">
              Handball-Video hochladen
            </h3>
            <p className="text-gray-600 mb-4 text-lg">
              Ziehen Sie Ihr Video hierher oder klicken Sie, um eine Datei auszuwählen
            </p>
          </div>

          <div className="flex gap-2 items-center text-sm text-gray-500 bg-sky-50 px-4 py-2 rounded-full border border-sky-200">
            <Video className="w-4 h-4" />
            <span>MP4, AVI, MOV, MKV</span>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="annotate-video"
              checked={annotateVideo}
              onCheckedChange={(checked) => setAnnotateVideo(checked === true)}
              disabled={isUploading}
            />
            <Label htmlFor="annotate-video" className="text-sm text-gray-500 font-normal">
              Annotiertes Debug-Video erzeugen (langsamer)
            </Label>
          </div>

          <label htmlFor="video-upload">
            <Button 
              type="button"
              disabled={isUploading}
              onClick={() => document.getElementById('video-upload')?.click()}
              className="bg-gradient-to-r from-blue-900 via-sky-600 to-orange-500 hover:from-blue-800 hover:via-sky-500 hover:to-orange-600 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                'Video auswählen'
              )}
            </Button>
          </label>
          
          {uploadError && (
            <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-200">
              {uploadError}
            </div>
          )}
          
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileInput}
            disabled={isUploading}
          />
        </div>
      </Card>
    </motion.div>
  );
}