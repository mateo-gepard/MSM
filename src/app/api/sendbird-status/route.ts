import { NextResponse } from 'next/server';

export async function GET() {
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
      `https://api-${appId}.sendbird.com/v3/group_channels?limit=50&show_member=true`,
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

    // Get messages for each channel
    const channelsWithMessages = await Promise.all(
      channelsData.channels.map(async (channel: any) => {
        try {
          const messagesResponse = await fetch(
            `https://api-${appId}.sendbird.com/v3/group_channels/${channel.channel_url}/messages?message_ts=${Date.now()}&prev_limit=10&next_limit=0`,
            {
              headers: {
                'Api-Token': apiToken
              }
            }
          );

          const messagesData = await messagesResponse.json();

          return {
            channel_url: channel.channel_url,
            name: channel.name,
            member_count: channel.member_count,
            members: channel.members.map((m: any) => ({
              user_id: m.user_id,
              nickname: m.nickname
            })),
            message_count: messagesData.messages?.length || 0,
            messages: messagesData.messages?.map((m: any) => ({
              message_id: m.message_id,
              message: m.message,
              user: m.user?.nickname || m.user?.user_id,
              created_at: new Date(m.created_at).toISOString()
            })) || []
          };
        } catch (error) {
          return {
            channel_url: channel.channel_url,
            name: channel.name,
            error: error instanceof Error ? error.message : 'Failed to fetch messages'
          };
        }
      })
    );

    return NextResponse.json({
      total_channels: channelsData.channels.length,
      channels: channelsWithMessages
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
