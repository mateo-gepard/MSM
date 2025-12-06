import SendbirdChat from '@sendbird/chat';
import { GroupChannelModule } from '@sendbird/chat/groupChannel';

let sendbirdInstance: any = null;
let currentUserId: string | null = null;

export async function initSendbird(userId: string, nickname?: string) {
  const appId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID;
  
  console.log('[Sendbird] Initializing with:', { 
    appId: appId ? `${appId.substring(0, 20)}...` : 'MISSING',
    userId,
    nickname
  });

  if (!appId) {
    const error = 'NEXT_PUBLIC_SENDBIRD_APP_ID not found in environment variables';
    console.error('[Sendbird]', error);
    throw new Error(error);
  }

  try {
    if (!sendbirdInstance) {
      console.log('[Sendbird] Creating new Sendbird instance...');
      sendbirdInstance = SendbirdChat.init({
        appId: appId,
        modules: [new GroupChannelModule()]
      });
      console.log('[Sendbird] Instance created successfully');
    } else {
      console.log('[Sendbird] Using existing instance');
      
      // If already connected to the same user, don't reconnect
      if (currentUserId === userId && sendbirdInstance.currentUser) {
        console.log('[Sendbird] Already connected to this user, skipping reconnection');
        return sendbirdInstance;
      }
      
      // If connected to different user, disconnect first
      if (currentUserId && currentUserId !== userId) {
        console.log('[Sendbird] Different user, disconnecting previous connection');
        await sendbirdInstance.disconnect();
      }
    }

    console.log('[Sendbird] Connecting user...');
    await sendbirdInstance.connect(userId, undefined, nickname);
    currentUserId = userId;
    console.log('[Sendbird] ✅ User connected successfully!');
    
    return sendbirdInstance;
  } catch (error) {
    console.error('[Sendbird] ❌ Initialization error:', error);
    throw error;
  }
}

export async function createParentTutorChannel(
  parentId: string,
  tutorId: string,
  tutorName: string
) {
  try {
    const sb = sendbirdInstance || SendbirdChat.instance;
    
    // Create a unique, deterministic channel URL based on both user IDs
    const sortedIds = [parentId, tutorId].sort();
    const channelUrl = `msm_chat_${sortedIds[0]}_${sortedIds[1]}`.substring(0, 100);
    
    console.log('[Sendbird] Creating/getting channel:', { parentId, tutorId, tutorName, channelUrl });
    
    // First, try to get existing channel
    try {
      const existingChannel = await sb.groupChannel.getChannel(channelUrl);
      console.log('[Sendbird] ✅ Found existing channel:', existingChannel.url);
      return existingChannel.url;
    } catch (getError) {
      // Channel doesn't exist, create it
      console.log('[Sendbird] Channel not found, creating new one...');
    }
    
    // Create channel with specific URL
    const params = {
      invitedUserIds: [tutorId],
      name: `Chat: ${tutorName}`,
      channelUrl: channelUrl,
      isDistinct: false, // We're managing uniqueness via channelUrl
      operatorUserIds: [parentId]
    };

    const channel = await sb.groupChannel.createChannel(params);
    console.log('[Sendbird] ✅ Channel created:', channel.url);
    return channel.url;
  } catch (error) {
    console.error('[Sendbird] ❌ Channel creation error:', error);
    throw error;
  }
}

export async function sendMessage(channelUrl: string, message: string) {
  try {
    const sb = sendbirdInstance || SendbirdChat.instance;
    
    console.log('[Sendbird] Sending message:', { channelUrl, message: message.substring(0, 50) });
    
    const channel = await sb.groupChannel.getChannel(channelUrl);
    console.log('[Sendbird] Channel retrieved:', { 
      url: channel.url, 
      name: channel.name,
      memberCount: channel.memberCount,
      members: channel.members.map((m: any) => ({ id: m.userId, nickname: m.nickname }))
    });
    
    const params = {
      message
    };

    const sentMessage = await channel.sendUserMessage(params);
    console.log('[Sendbird] ✅ Message sent successfully:', {
      messageId: sentMessage.messageId,
      message: sentMessage.message,
      createdAt: sentMessage.createdAt,
      sender: sentMessage.sender?.userId
    });
    
    return sentMessage;
  } catch (error) {
    console.error('[Sendbird] ❌ Send message error:', error);
    throw error;
  }
}

export async function getMessages(channelUrl: string, limit: number = 50) {
  try {
    const sb = sendbirdInstance || SendbirdChat.instance;
    
    console.log('[Sendbird] Fetching messages from:', channelUrl);
    
    const channel = await sb.groupChannel.getChannel(channelUrl);
    
    const messages = await channel.getMessagesByTimestamp(Date.now(), {
      prevResultSize: limit,
      nextResultSize: 0
    });

    console.log('[Sendbird] ✅ Retrieved messages:', {
      count: messages.length,
      channelUrl,
      messages: messages.slice(0, 3).map((m: any) => ({
        id: m.messageId,
        message: m.message?.substring(0, 50),
        sender: m.sender?.userId,
        createdAt: m.createdAt
      }))
    });

    return messages;
  } catch (error) {
    console.error('[Sendbird] ❌ Get messages error:', error);
    return [];
  }
}

export function disconnectSendbird() {
  if (sendbirdInstance) {
    console.log('[Sendbird] Disconnecting user:', currentUserId);
    sendbirdInstance.disconnect();
    sendbirdInstance = null;
    currentUserId = null;
  }
}
