'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tutors } from '@/data/mockData';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import { User, ArrowRight, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TutorLogin() {
  const router = useRouter();
  const [selectedTutor, setSelectedTutor] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleLogin = () => {
    if (!selectedTutor) {
      setError('Bitte wähle deinen Namen aus');
      return;
    }

    const tutor = tutors.find(t => t.name === selectedTutor);
    if (!tutor) {
      setError('Tutor nicht gefunden');
      return;
    }

    // Redirect to tutor dashboard
    router.push(`/tutor-dashboard/${tutor.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <FrostedCard className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Tutor Dashboard</h1>
            <p className="text-gray-400">
              Wähle deinen Namen, um auf dein Dashboard zuzugreifen
            </p>
          </div>

          {/* Tutor Selection */}
          <div className="space-y-4 mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dein Name
            </label>
            
            <div className="space-y-2">
              {tutors.map((tutor) => (
                <button
                  key={tutor.id}
                  onClick={() => {
                    setSelectedTutor(tutor.name);
                    setError('');
                  }}
                  className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                    selectedTutor === tutor.name
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      selectedTutor === tutor.name
                        ? 'bg-accent text-white'
                        : 'bg-secondary-dark text-gray-400'
                    }`}>
                      {tutor.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${
                        selectedTutor === tutor.name ? 'text-white' : 'text-gray-300'
                      }`}>
                        {tutor.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tutor.subjects.slice(0, 2).join(', ')}
                        {tutor.subjects.length > 2 && ` +${tutor.subjects.length - 2}`}
                      </div>
                    </div>
                    {selectedTutor === tutor.name && (
                      <UserCheck className="w-5 h-5 text-accent" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            disabled={!selectedTutor}
            className="w-full flex items-center justify-center gap-2"
          >
            Zum Dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center">
              🔒 Dieses Dashboard ist nur für Tutoren zugänglich
            </p>
          </div>
        </FrostedCard>
      </motion.div>
    </div>
  );
}
