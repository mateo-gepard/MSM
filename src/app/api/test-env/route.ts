import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.CALCOM_API_KEY || process.env.NEXT_PUBLIC_CALCOM_API_KEY;
  
  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPreview: apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT_FOUND',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('CAL'))
  });
}
