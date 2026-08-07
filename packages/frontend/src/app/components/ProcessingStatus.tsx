import { Activity, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { motion } from 'motion/react';

interface ProcessingStatusProps {
  fileName: string;
  progress: number;
  currentStep: string;
  isComplete: boolean;
}

export function ProcessingStatus({ fileName, progress, currentStep, isComplete }: ProcessingStatusProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="p-8 shadow-2xl border-2 border-sky-200 bg-gradient-to-br from-white to-sky-50">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            {isComplete ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-lg"
              >
                <CheckCircle2 className="w-8 h-8 text-white" />
              </motion.div>
            ) : (
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1, repeat: Infinity }
                }}
                className="p-3 bg-gradient-to-br from-sky-500 to-orange-500 rounded-full shadow-lg"
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>
            )}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{fileName}</h3>
              <p className="text-gray-600 mt-1">{currentStep}</p>
            </div>
            <div className="text-right">
              <motion.div 
                className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-orange-600 bg-clip-text text-transparent"
                key={progress}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {progress}%
              </motion.div>
            </div>
          </div>

          <div className="relative">
            <Progress value={progress} className="h-3 bg-gray-200" />
            <motion.div
              className="absolute top-0 left-0 h-3 bg-gradient-to-r from-blue-900 via-sky-500 to-orange-500 rounded-full"
              style={{ width: `${progress}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {!isComplete && (
            <motion.div 
              className="flex items-center gap-3 text-gray-600 bg-sky-50 px-4 py-3 rounded-lg border border-sky-200"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Clock className="w-5 h-5" />
              <span className="font-medium">Geschätzte Restzeit: {Math.max(1, Math.ceil((100 - progress) / 10))} Min</span>
            </motion.div>
          )}

          {isComplete && (
            <motion.div 
              className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4 text-green-700 font-medium shadow-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>Analyse erfolgreich abgeschlossen - Match-Report wird geladen...</span>
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}