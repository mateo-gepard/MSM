import { NextResponse } from 'next/server';

export async function POST() {
  const appId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID;
  const apiToken = process.env.SENDBIRD_API_TOKEN;

  if (!appId || !apiToken) {
    return NextResponse.json(
      { error: 'Sendbird credentials not configured' },
      { status: 500 }
    );
  }

  try {
    // Get all channels
    const channelsResponse = await fetch(
      `https://api-${appId}.sendbird.com/v3/group_channels?limit=50`,
      {
        headers: {
          'Api-Token': apiToken
        }
      }
    );

    if (!channelsResponse.ok) {
      throw new Error(`Failed to fetch channels: ${channelsResponse.status}`);
    }

    const channelsData = await channelsResponse.json();
    const deletedChannels = [];

    // Delete each channel
    for (const channel of channelsData.channels) {
      try {
        const deleteResponse = await fetch(
          `https://api-${appId}.sendbird.com/v3/group_channels/${channel.channel_url}`,
          {
            method: 'DELETE',
            headers: {
              'Api-Token': apiToken
            }
          }
        );

        if (deleteResponse.ok) {
          deletedChannels.push({
            channel_url: channel.channel_url,
            name: channel.name,
            status: 'deleted'
          });
        } else {
          deletedChannels.push({
            channel_url: channel.channel_url,
            name: channel.name,
            status: 'failed',
            error: await deleteResponse.text()
          });
        }
      } catch (error) {
        deletedChannels.push({
          channel_url: channel.channel_url,
          name: channel.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return NextResponse.json({
      message: 'Channel cleanup complete',
      total_deleted: deletedChannels.filter(c => c.status === 'deleted').length,
      results: deletedChannels
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to delete all Sendbird channels',
    warning: 'This will delete ALL channels and messages. Use with caution.'
  });
}
