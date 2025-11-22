'use client';

import { useEffect, useState } from 'react';
import { initSendbird } from '@/lib/sendbird';

export default function SendbirdTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [appId, setAppId] = useState<string>('');

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const clientAppId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID || 'NOT_FOUND';
    setAppId(clientAppId);
    addLog(`Client-side App ID: ${clientAppId}`);
  }, []);

  const testConnection = async () => {
    addLog('🔄 Starting Sendbird test...');
    
    try {
      const testUserId = `test_${Date.now()}`;
      addLog(`Attempting to connect with userId: ${testUserId}`);
      
      const result = await initSendbird(testUserId, 'Test User');
      
      if (result) {
        addLog('✅ SUCCESS! Sendbird connected!');
      } else {
        addLog('❌ FAILED: initSendbird returned null');
      }
    } catch (error) {
      addLog(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Full error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-4">🧪 Sendbird Connection Test</h1>
          
          <div className="mb-4 p-4 bg-black/30 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Environment Check:</p>
            <p className="font-mono text-sm text-white">
              NEXT_PUBLIC_SENDBIRD_APP_ID = <span className={appId === 'NOT_FOUND' ? 'text-red-400' : 'text-green-400'}>
                {appId}
              </span>
            </p>
            {appId === 'NOT_FOUND' && (
              <p className="text-red-400 text-xs mt-2">
                ⚠️ App ID not found! Check your .env.local file
              </p>
            )}
          </div>

          <button
            onClick={testConnection}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors font-semibold"
          >
            🚀 Test Connection
          </button>

          <div className="mt-4 text-xs text-gray-400">
            <p>Expected App ID: A30F1E34-BD5D-4B38-8FDC-DBEF4112A510</p>
            <p>SDK Version: @sendbird/chat ^4.20.2</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">📋 Connection Logs</h2>
          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Click "Test Connection" to start.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`
                  ${log.includes('✅') ? 'text-green-400' : ''}
                  ${log.includes('❌') ? 'text-red-400' : ''}
                  ${log.includes('🔄') ? 'text-blue-400' : ''}
                  ${!log.includes('✅') && !log.includes('❌') && !log.includes('🔄') ? 'text-gray-300' : ''}
                `}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
          <p className="text-yellow-200 text-sm">
            <strong>💡 Debugging Tips:</strong>
          </p>
          <ul className="text-yellow-200/80 text-xs mt-2 space-y-1 list-disc list-inside">
            <li>Open Browser Console (F12) to see detailed error messages</li>
            <li>Ensure .env.local contains: NEXT_PUBLIC_SENDBIRD_APP_ID=A30F1E34-BD5D-4B38-8FDC-DBEF4112A510</li>
            <li>Restart dev server after changing .env.local</li>
            <li>Check <a href="/api/test-sendbird" className="underline" target="_blank">/api/test-sendbird</a> endpoint</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
