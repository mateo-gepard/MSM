import SendbirdChat from '@sendbird/chat';
import { GroupChannelModule } from '@sendbird/chat/groupChannel';

let sendbirdInstance: any = null;

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
    }

    console.log('[Sendbird] Connecting user...');
    await sendbirdInstance.connect(userId, undefined, nickname);
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
    
    const params = {
      invitedUserIds: [parentId, tutorId],
      name: `Chat with ${tutorName}`,
      isDistinct: true // Prevents duplicate channels
    };

    const channel = await sb.groupChannel.createChannel(params);
    return channel.url;
  } catch (error) {
    console.error('Sendbird channel creation error:', error);
    throw error;
  }
}

export async function sendMessage(channelUrl: string, message: string) {
  try {
    const sb = sendbirdInstance || SendbirdChat.instance;
    const channel = await sb.groupChannel.getChannel(channelUrl);
    
    const params = {
      message
    };

    await channel.sendUserMessage(params);
  } catch (error) {
    console.error('Sendbird send message error:', error);
    throw error;
  }
}

export async function getMessages(channelUrl: string, limit: number = 50) {
  try {
    const sb = sendbirdInstance || SendbirdChat.instance;
    const channel = await sb.groupChannel.getChannel(channelUrl);
    
    const messages = await channel.getMessagesByTimestamp(Date.now(), {
      prevResultSize: limit
    });

    return messages;
  } catch (error) {
    console.error('Sendbird get messages error:', error);
    return [];
  }
}

export function disconnectSendbird() {
  if (sendbirdInstance) {
    sendbirdInstance.disconnect();
    sendbirdInstance = null;
  }
}
