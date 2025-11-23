import { NextRequest, NextResponse } from 'next/server';

const CALCOM_API_BASE = 'https://api.cal.com/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventTypeId, start, responses, metadata, timeZone, language } = body;

    // Use server-side environment variable (not NEXT_PUBLIC_)
    const apiKey = process.env.CALCOM_API_KEY || process.env.NEXT_PUBLIC_CALCOM_API_KEY;

    console.log('=== Cal.com Booking API Debug ===');
    console.log('API Key exists:', !!apiKey);
    console.log('API Key prefix:', apiKey?.substring(0, 10) + '...');
    console.log('Event Type ID:', eventTypeId);
    console.log('Start time:', start);
    console.log('TimeZone:', timeZone);
    console.log('Language:', language);
    console.log('Responses:', JSON.stringify(responses, null, 2));
    console.log('Metadata:', JSON.stringify(metadata, null, 2));

    if (!apiKey) {
      console.error('❌ ERROR: No Cal.com API key found in environment variables');
      return NextResponse.json(
        { 
          error: 'Cal.com API key not configured',
          hint: 'Add CALCOM_API_KEY to your environment variables' 
        },
        { status: 500 }
      );
    }

    console.log('Creating Cal.com booking via API proxy...');
    
    // Cal.com requires API key as query parameter, not in header
    const url = new URL(`${CALCOM_API_BASE}/bookings`);
    url.searchParams.append('apiKey', apiKey);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventTypeId,
        start,
        responses,
        metadata,
        timeZone: timeZone || 'Europe/Berlin',
        language: language || 'de'
      })
    });

    const responseText = await response.text();
    console.log('📡 Cal.com API Response Status:', response.status);
    console.log('📡 Cal.com API Response Body:', responseText);

    if (!response.ok) {
      console.error('❌ Cal.com API error:', response.status, responseText);
      
      let errorDetails = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorDetails = JSON.stringify(errorJson, null, 2);
        
        // Check for specific error
        if (errorJson.message === 'no_available_users_found_error') {
          console.error('🚨 NO AVAILABLE USERS ERROR');
          console.error('Possible causes:');
          console.error('1. Event Type has no hosts assigned');
          console.error('2. No availability set for the selected time');
          console.error('3. Event Type is inactive');
          console.error('');
          console.error('Fix: Go to https://app.cal.com/event-types/' + eventTypeId);
          console.error('- Assign yourself as a host');
          console.error('- Set availability hours');
          console.error('- Make sure Event Type is active');
        }
      } catch (e) {
        // Keep original text if not JSON
      }
      
      return NextResponse.json(
        { 
          error: 'Booking creation failed', 
          details: errorDetails, 
          status: response.status,
          hint: responseText.includes('no_available_users_found_error') 
            ? 'Event Type has no available hosts. Configure hosts and availability in Cal.com.'
            : undefined
        },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);
    console.log('Cal.com booking created successfully:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Booking API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventTypeId = searchParams.get('eventTypeId');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    const apiKey = process.env.CALCOM_API_KEY || process.env.NEXT_PUBLIC_CALCOM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Cal.com API key not configured' },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      eventTypeId: eventTypeId || '',
      startTime: startTime || '',
      endTime: endTime || '',
      apiKey: apiKey
    });

    const response = await fetch(
      `${CALCOM_API_BASE}/availability?${params}`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cal.com availability error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch availability', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Availability API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
