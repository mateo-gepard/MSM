'use client';

import { useState } from 'react';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';

export default function AdminPage() {
  const [registrationResult, setRegistrationResult] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const registerTutors = async () => {
    setIsRegistering(true);
    setRegistrationResult(null);
    try {
      const response = await fetch('/api/register-tutors', {
        method: 'POST'
      });
      const data = await response.json();
      setRegistrationResult(data);
    } catch (error) {
      setRegistrationResult({ error: String(error) });
    } finally {
      setIsRegistering(false);
    }
  };

  const checkStatus = async () => {
    setIsLoadingStatus(true);
    setStatusResult(null);
    try {
      const response = await fetch('/api/sendbird-status');
      const data = await response.json();
      setStatusResult(data);
    } catch (error) {
      setStatusResult({ error: String(error) });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Panel - Sendbird Setup</h1>

        {/* Register Tutors */}
        <FrostedCard className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            Register Tutors in Sendbird
          </h2>
          <p className="text-gray-400 mb-4">
            Click this button to register all tutors as users in Sendbird. This must be done before they can receive messages.
          </p>
          <Button
            onClick={registerTutors}
            disabled={isRegistering}
            className="flex items-center gap-2"
          >
            {isRegistering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registering...
              </>
            ) : (
              'Register All Tutors'
            )}
          </Button>

          {registrationResult && (
            <div className="mt-4 p-4 bg-secondary-dark rounded-lg">
              <h3 className="text-white font-semibold mb-2">Registration Results:</h3>
              {registrationResult.error ? (
                <p className="text-red-400">{registrationResult.error}</p>
              ) : (
                <div className="space-y-2">
                  {registrationResult.results?.map((result: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      {result.status === 'created' || result.status === 'already_exists' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-gray-300">
                        {result.tutor} (ID: {result.id}) - {result.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </FrostedCard>

        {/* Check Sendbird Status */}
        <FrostedCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Sendbird Status</h2>
          <p className="text-gray-400 mb-4">
            View all channels and messages currently stored in Sendbird.
          </p>
          <Button
            onClick={checkStatus}
            disabled={isLoadingStatus}
            className="flex items-center gap-2"
            variant="secondary"
          >
            {isLoadingStatus ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Check Sendbird Status'
            )}
          </Button>

          {statusResult && (
            <div className="mt-4 p-4 bg-secondary-dark rounded-lg max-h-96 overflow-y-auto">
              <h3 className="text-white font-semibold mb-2">Status:</h3>
              {statusResult.error ? (
                <p className="text-red-400">{statusResult.error}</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-300">Total Channels: {statusResult.total_channels}</p>
                  {statusResult.channels?.map((channel: any, idx: number) => (
                    <div key={idx} className="border border-white/10 rounded p-3">
                      <h4 className="text-white font-medium">{channel.name}</h4>
                      <p className="text-sm text-gray-400">URL: {channel.channel_url}</p>
                      <p className="text-sm text-gray-400">Members: {channel.member_count}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {channel.members?.map((m: any) => m.nickname || m.user_id).join(', ')}
                      </div>
                      {channel.message_count > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-green-400">Messages: {channel.message_count}</p>
                          <div className="text-xs text-gray-400 mt-1 space-y-1">
                            {channel.messages?.map((msg: any) => (
                              <div key={msg.message_id}>
                                <strong>{msg.user}:</strong> {msg.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </FrostedCard>
      </div>
    </div>
  );
}
