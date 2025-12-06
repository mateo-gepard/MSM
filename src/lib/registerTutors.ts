// Script to register all tutors in Sendbird
// Run this once to ensure all tutors have Sendbird accounts

import { tutors } from '@/data/tutors';

export async function registerTutorsInSendbird() {
  const appId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID;
  const apiToken = process.env.SENDBIRD_API_TOKEN;

  if (!appId || !apiToken) {
    throw new Error('Sendbird credentials not configured');
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

      if (response.ok) {
        results.push({ tutor: tutor.name, status: 'created', id: tutor.id });
      } else if (response.status === 400) {
        // User already exists
        results.push({ tutor: tutor.name, status: 'exists', id: tutor.id });
      } else {
        const error = await response.text();
        results.push({ tutor: tutor.name, status: 'error', error });
      }
    } catch (error) {
      results.push({ tutor: tutor.name, status: 'error', error: String(error) });
    }
  }

  return results;
}
