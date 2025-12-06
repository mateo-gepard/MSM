import { NextResponse } from 'next/server';
import { tutors } from '@/data/tutors';

export async function POST() {
  const appId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID;
  const apiToken = process.env.SENDBIRD_API_TOKEN;

  if (!appId || !apiToken) {
    return NextResponse.json(
      { error: 'Sendbird credentials not configured' },
      { status: 500 }
    );
  }

  const results = [];

  for (const tutor of tutors) {
    try {
      // Create user via REST API
      const response = await fetch(`https://api-${appId}.sendbird.com/v3/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken
        },
        body: JSON.stringify({
          user_id: tutor.id,
          nickname: tutor.name,
          profile_url: tutor.image || '',
          issue_access_token: false
        })
      });

      const data = await response.json();

      if (response.ok) {
        results.push({ tutor: tutor.name, status: 'created', id: tutor.id });
      } else if (response.status === 400 && data.code === 400202) {
        // User already exists (error code 400202)
        results.push({ tutor: tutor.name, status: 'already_exists', id: tutor.id });
      } else {
        results.push({ tutor: tutor.name, status: 'error', error: data });
      }
    } catch (error) {
      results.push({ 
        tutor: tutor.name, 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  return NextResponse.json({ results });
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to register tutors in Sendbird',
    tutors: tutors.map(t => ({ id: t.id, name: t.name }))
  });
}
