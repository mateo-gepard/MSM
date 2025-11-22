import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID;
  const apiToken = process.env.SENDBIRD_API_TOKEN;

  return NextResponse.json({
    hasAppId: !!appId,
    appId: appId ? `${appId.substring(0, 10)}...${appId.substring(appId.length - 10)}` : 'NOT_FOUND',
    hasApiToken: !!apiToken,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('SENDBIRD'))
    }
  });
}
