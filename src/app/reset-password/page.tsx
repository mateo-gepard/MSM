'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Lock, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      setLoading(false);
      return;
    }

    const { error: authError } = await updatePassword(password);
    
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      
      // Mark password as set in localStorage to hide the banner
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        localStorage.setItem(`passwordSet_${user.id}`, 'true');
      }
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Neues Passwort setzen
            </h1>
            <p className="text-gray-400">
              Wähle ein sicheres neues Passwort für deinen Account
            </p>
          </div>

          <FrostedCard className="p-8">
            {/* Success State */}
            {success ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-16 h-16 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Passwort erfolgreich geändert!
                </h2>
                <p className="text-gray-400">
                  Du wirst zum Dashboard weitergeleitet...
                </p>
              </div>
            ) : (
              <>
                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Reset Password Form */}
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Neues Passwort
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Mindestens 6 Zeichen
                    </p>
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Passwort bestätigen
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {/* Password Match Indicator */}
                  {password && confirmPassword && (
                    <div className="flex items-center gap-2">
                      {password === confirmPassword ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-xs ${
                        password === confirmPassword ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {password === confirmPassword 
                          ? 'Passwörter stimmen überein' 
                          : 'Passwörter stimmen nicht überein'}
                      </span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Speichern...' : 'Passwort ändern'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </form>
              </>
            )}
          </FrostedCard>

          {/* Back to Login */}
          <div className="text-center mt-6">
            <Link href="/login" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Zurück zum Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
