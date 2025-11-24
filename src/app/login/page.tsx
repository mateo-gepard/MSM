'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signUp, sendMagicLink, resetPassword } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Mail, Lock, User, ArrowRight, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup' | 'magic' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showLoginRequired, setShowLoginRequired] = useState(false);

  useEffect(() => {
    const redirect = searchParams.get('redirect');
    const message = searchParams.get('message');
    
    if (redirect) {
      setRedirectUrl(redirect);
    }
    
    if (message === 'login-required') {
      setShowLoginRequired(true);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await signIn(email, password);
    
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else if (data.user) {
      // Redirect to the saved URL or dashboard
      router.push(redirectUrl || '/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await signUp(email, password, name);
    
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else if (data.user) {
      // Redirect after signup
      setSuccess('Account erstellt! Du wirst weitergeleitet...');
      setTimeout(() => {
        router.push(redirectUrl || '/dashboard');
      }, 1500);
    } else {
      setSuccess('Account erstellt! Bitte überprüfe deine E-Mail zur Bestätigung.');
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Pass redirect URL to magic link
    const { error: authError } = await sendMagicLink(email, redirectUrl || undefined);
    
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setSuccess('Magic Link wurde gesendet! Überprüfe deine E-Mail und klicke auf den Link.');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await resetPassword(email);
    
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setSuccess('Passwort-Reset-Link wurde gesendet! Überprüfe deine E-Mail.');
      setLoading(false);
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
              {mode === 'login' && 'Willkommen zurück'}
              {mode === 'signup' && 'Account erstellen'}
              {mode === 'magic' && 'Magic Link Login'}
              {mode === 'reset' && 'Passwort zurücksetzen'}
            </h1>
            <p className="text-gray-400">
              {mode === 'login' && 'Melde dich an um fortzufahren'}
              {mode === 'signup' && 'Erstelle deinen Account für Elite Tutoring'}
              {mode === 'magic' && 'Login ohne Passwort via E-Mail'}
              {mode === 'reset' && 'Wir senden dir einen Link zum Zurücksetzen'}
            </p>
          </div>

          <FrostedCard className="p-8">
            {/* Login Required Message */}
            {showLoginRequired && (
              <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-blue-200 font-semibold mb-1">
                      Login erforderlich
                    </div>
                    <div className="text-blue-300 text-sm">
                      Um eine Buchung abzuschließen, musst du eingeloggt sein. 
                      Deine Auswahl (Tutor & Fach) wird nach dem Login wiederhergestellt.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                {success}
              </div>
            )}

            {/* Login Form */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-white font-semibold mb-2">E-Mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="deine@email.de"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">Passwort</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Anmelden...' : 'Anmelden'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                {/* Forgot Password Link */}
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="block w-full text-center text-gray-400 hover:text-accent transition-colors text-sm"
                >
                  Passwort vergessen?
                </button>
              </form>
            )}

            {/* Signup Form */}
            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-white font-semibold mb-2">Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="Max Mustermann"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">E-Mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="deine@email.de"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">Passwort</label>
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
                  <p className="text-xs text-gray-400 mt-1">Mindestens 6 Zeichen</p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Erstellen...' : 'Account erstellen'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </form>
            )}

            {/* Magic Link Form */}
            {mode === 'magic' && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="mb-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <KeyRound className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-white font-semibold mb-1">
                        Login ohne Passwort
                      </div>
                      <div className="text-gray-300 text-sm">
                        Gib deine E-Mail ein und erhalte einen Login-Link. 
                        <strong className="text-accent"> Funktioniert auch wenn du noch keinen Account hast</strong> - 
                        wir erstellen automatisch einen für dich.
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">E-Mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="deine@email.de"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Senden...' : 'Magic Link senden'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  Nach dem Klick auf den Link in deiner E-Mail bist du eingeloggt
                </p>
              </form>
            )}

            {/* Password Reset Form */}
            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-white font-semibold mb-2">E-Mail</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="deine@email.de"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Senden...' : 'Reset-Link senden'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  Du erhältst einen Link zum Zurücksetzen deines Passworts per E-Mail
                </p>
              </form>
            )}

            {/* Mode Switch */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              {mode === 'login' && (
                <>
                  <button
                    onClick={() => setMode('signup')}
                    className="block w-full text-center text-accent hover:text-accent/80 transition-colors text-sm"
                  >
                    Noch kein Account? Jetzt registrieren
                  </button>
                  <button
                    onClick={() => setMode('magic')}
                    className="block w-full text-center text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    Login ohne Passwort (Magic Link)
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button
                  onClick={() => setMode('login')}
                  className="block w-full text-center text-accent hover:text-accent/80 transition-colors text-sm"
                >
                  Bereits registriert? Jetzt anmelden
                </button>
              )}
              {mode === 'magic' && (
                <button
                  onClick={() => setMode('login')}
                  className="block w-full text-center text-accent hover:text-accent/80 transition-colors text-sm"
                >
                  Zurück zum Login
                </button>
              )}
              {mode === 'reset' && (
                <button
                  onClick={() => setMode('login')}
                  className="block w-full text-center text-accent hover:text-accent/80 transition-colors text-sm"
                >
                  Zurück zum Login
                </button>
              )}
            </div>
          </FrostedCard>

          {/* Back to Home */}
          <div className="text-center mt-6">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Zurück zur Startseite
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
