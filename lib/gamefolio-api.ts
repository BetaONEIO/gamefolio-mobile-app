import { Platform } from 'react-native';

const GAMEFOLIO_API_BASE = 'https://app.gamefolio.com/api/trpc';
const GAMEFOLIO_REST_API = 'https://app.gamefolio.com/api';

// Store Gamefolio tokens separately for upload operations
let gamefolioAccessToken: string | null = null;
let gamefolioRefreshToken: string | null = null;
let gamefolioTokenExpiry: number = 0;

export interface GamefolioAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: number;
    username: string;
    displayName: string;
  };
}

// Authenticate directly with Gamefolio API
export async function authenticateWithGamefolio(
  username: string,
  password: string
): Promise<GamefolioAuthResult> {
  console.log('[Gamefolio Auth] Authenticating directly with Gamefolio...');
  
  const response = await fetch(`${GAMEFOLIO_REST_API}/auth/token/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gamefolio Auth] Login failed:', response.status, errorText);
    throw new Error('Failed to authenticate with Gamefolio');
  }

  const data = await response.json();
  console.log('[Gamefolio Auth] Login successful');
  
  // Store tokens for later use
  gamefolioAccessToken = data.accessToken;
  gamefolioRefreshToken = data.refreshToken;
  gamefolioTokenExpiry = Date.now() + (data.expiresIn * 1000);
  
  return data;
}

// Set Gamefolio tokens from external source (e.g., after main app login)
// issuedAt is optional - if provided, expiry is calculated from issuedAt + expiresIn
// if not provided, expiry is calculated from now + expiresIn (for fresh tokens)
export function setGamefolioTokens(accessToken: string, refreshToken?: string, expiresIn?: number, issuedAt?: number) {
  console.log('[Gamefolio Auth] Setting Gamefolio tokens externally');
  console.log('[Gamefolio Auth] Token length:', accessToken?.length);
  console.log('[Gamefolio Auth] ExpiresIn:', expiresIn, 'IssuedAt:', issuedAt);
  gamefolioAccessToken = accessToken;
  if (refreshToken) gamefolioRefreshToken = refreshToken;
  if (expiresIn) {
    // If issuedAt is provided, calculate from that timestamp; otherwise use now (for fresh tokens)
    const baseTime = issuedAt || Date.now();
    gamefolioTokenExpiry = baseTime + (expiresIn * 1000);
    console.log('[Gamefolio Auth] Token expiry set to:', new Date(gamefolioTokenExpiry).toISOString());
    console.log('[Gamefolio Auth] Time until expiry:', Math.round((gamefolioTokenExpiry - Date.now()) / 1000), 'seconds');
  }
}

// Get valid Gamefolio token, refreshing if needed
export async function getGamefolioToken(): Promise<string | null> {
  if (!gamefolioAccessToken) {
    console.log('[Gamefolio Auth] No Gamefolio token available');
    return null;
  }
  
  // Check if token needs refresh (within 5 minutes of expiry)
  if (gamefolioTokenExpiry > 0 && Date.now() > gamefolioTokenExpiry - 300000) {
    console.log('[Gamefolio Auth] Token expiring soon, attempting refresh...');
    if (gamefolioRefreshToken) {
      try {
        const response = await fetch(`${GAMEFOLIO_REST_API}/auth/token/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ refreshToken: gamefolioRefreshToken }),
        });
        
        if (response.ok) {
          const data = await response.json();
          gamefolioAccessToken = data.accessToken;
          if (data.refreshToken) gamefolioRefreshToken = data.refreshToken;
          gamefolioTokenExpiry = Date.now() + (data.expiresIn * 1000);
          console.log('[Gamefolio Auth] Token refreshed successfully');
        }
      } catch (error) {
        console.error('[Gamefolio Auth] Token refresh failed:', error);
      }
    }
  }
  
  return gamefolioAccessToken;
}

// Clear Gamefolio tokens (on logout)
export function clearGamefolioTokens() {
  gamefolioAccessToken = null;
  gamefolioRefreshToken = null;
  gamefolioTokenExpiry = 0;
}

interface TRPCResponse<T> {
  result: {
    data: T;
  };
}

interface GamefolioConversation {
  id: number;
  recipientId: number;
  recipient: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

interface GamefolioMessage {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  createdAt: string;
  isRead: boolean;
}

async function gamefolioFetch<T>(
  endpoint: string,
  accessToken: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    params?: Record<string, string | number>;
  }
): Promise<T> {
  const { method = 'GET', body, params } = options || {};
  
  let url = `${GAMEFOLIO_API_BASE}/${endpoint}`;
  
  if (params && method === 'GET') {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  console.log(`[Gamefolio API] ${method} ${url}`);

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method === 'POST') {
    fetchOptions.body = JSON.stringify({ input: body });
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gamefolio API] Error ${response.status}:`, errorText);
    throw new Error(`Gamefolio API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as TRPCResponse<T>;
  console.log(`[Gamefolio API] Response received for ${endpoint}`);
  
  return data.result.data;
}

export const gamefolioMessages = {
  getConversations: async (accessToken: string): Promise<GamefolioConversation[]> => {
    console.log('[Gamefolio API] Getting conversations');
    return gamefolioFetch<GamefolioConversation[]>('messages.getConversations', accessToken);
  },

  getMessages: async (accessToken: string, userId: number): Promise<GamefolioMessage[]> => {
    console.log('[Gamefolio API] Getting messages with user:', userId);
    return gamefolioFetch<GamefolioMessage[]>('messages.getMessages', accessToken, {
      params: { userId },
    });
  },

  send: async (accessToken: string, receiverId: number, content: string): Promise<GamefolioMessage> => {
    console.log('[Gamefolio API] Sending message to:', receiverId);
    return gamefolioFetch<GamefolioMessage>('messages.send', accessToken, {
      method: 'POST',
      body: { receiverId, content },
    });
  },

  deleteMessage: async (accessToken: string, messageId: number): Promise<{ success: boolean }> => {
    console.log('[Gamefolio API] Deleting message:', messageId);
    return gamefolioFetch<{ success: boolean }>('messages.deleteMessage', accessToken, {
      method: 'POST',
      body: { messageId },
    });
  },

  deleteConversation: async (accessToken: string, userId: number): Promise<{ success: boolean }> => {
    console.log('[Gamefolio API] Deleting conversation with user:', userId);
    return gamefolioFetch<{ success: boolean }>('messages.deleteConversation', accessToken, {
      method: 'POST',
      body: { userId },
    });
  },

  markRead: async (accessToken: string, userId: number): Promise<{ success: boolean }> => {
    console.log('[Gamefolio API] Marking messages as read from user:', userId);
    return gamefolioFetch<{ success: boolean }>('messages.markRead', accessToken, {
      method: 'POST',
      body: { userId },
    });
  },
};

interface VideoUploadStep1Response {
  success: boolean;
  result: {
    url: string;
    path: string;
  };
}

interface VideoUploadStep2Response {
  success: boolean;
  id: number;
  shareCode: string;
  shareUrl: string;
  qrCode: string;
  socialMediaLinks: Record<string, string>;
  xpGained: number;
  userXP: number;
  userLevel: number;
}

interface ScreenshotUploadResponse {
  success: boolean;
  screenshot: {
    id: number;
    [key: string]: unknown;
  };
  xpGained: number;
  userXP: number;
  userLevel: number;
  message: string;
}

interface UploadData {
  title: string;
  description: string;
  gameId: string;
  tags?: string[];
  ageRestricted?: boolean;
  trimStart?: number;
  trimEnd?: number;
}

interface UploadErrorData {
  message: string;
  error?: string;
  limits?: {
    message: string;
  };
}

export interface ClipUploadResult {
  success: boolean;
  id: number;
  shareCode: string;
  shareUrl: string;
  xpGained: number;
  userXP: number;
  userLevel: number;
}

export interface ScreenshotUploadResult {
  success: boolean;
  screenshotId: number;
  xpGained: number;
  userXP: number;
  userLevel: number;
}

export class UploadLimitError extends Error {
  limits?: { message: string };
  
  constructor(message: string, limits?: { message: string }) {
    super(message);
    this.name = 'UploadLimitError';
    this.limits = limits;
  }
}

async function handleUploadError(response: Response, context: string): Promise<never> {
  console.error(`[Gamefolio Upload] ${context} failed with status:`, response.status);
  const errorText = await response.text();
  console.error(`[Gamefolio Upload] Error response:`, errorText);
  
  let errorData: UploadErrorData;
  try {
    errorData = JSON.parse(errorText);
  } catch {
    errorData = { message: errorText };
  }
  
  const errorMessage = errorData.limits?.message || errorData.error || errorData.message || 'Unknown error';
  
  if (response.status === 401) {
    throw new Error('Authentication failed: Your session may have expired. Please log out and log back in.');
  } else if (response.status === 403) {
    throw new UploadLimitError(errorMessage, errorData.limits);
  } else if (response.status === 400) {
    throw new Error('Invalid data: ' + errorMessage);
  } else if (response.status === 500) {
    throw new Error('Server error: Please try again later');
  }
  
  throw new Error(`${context} failed: ${response.status} - ${errorMessage}`);
}

async function createFileEntry(
  fileUri: string,
  filename: string,
  filetype: string
): Promise<any> {
  if (Platform.OS === 'web') {
    console.log('[Gamefolio Upload] Web platform detected, fetching blob...');
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: filetype });
    console.log('[Gamefolio Upload] Created File object:', file.name, file.size, file.type);
    return file;
  } else {
    // React Native FormData requires this specific format
    // Ensure URI is properly formatted for the platform
    let uri = fileUri;
    
    // On iOS, file:// prefix is required
    if (Platform.OS === 'ios' && !uri.startsWith('file://') && !uri.startsWith('ph://')) {
      uri = `file://${uri}`;
    }
    
    const fileEntry = {
      uri: uri,
      type: filetype,
      name: filename,
    };
    
    console.log('[Gamefolio Upload] Native file entry:', JSON.stringify(fileEntry));
    return fileEntry;
  }
}

export const gamefolioUpload = {
  /**
   * Upload a clip or reel (two-step process)
   * Step 1: POST /api/upload/video-direct with FormData (file, uploadType, filename, filetype)
   * Step 2: POST /api/upload/process-video with JSON body
   */
  uploadClipOrReel: async (
    fileUri: string,
    uploadType: 'clip' | 'reel',
    data: UploadData,
    accessToken: string,
    assetMimeType?: string
  ): Promise<ClipUploadResult> => {
    console.log(`[Gamefolio Upload] Starting ${uploadType} upload`);
    console.log('[Gamefolio Upload] File URI:', fileUri);
    console.log('[Gamefolio Upload] Asset MIME type:', assetMimeType);
    console.log('[Gamefolio Upload] Data:', data);
    console.log('[Gamefolio Upload] Auth token length:', accessToken.length);
    console.log('[Gamefolio Upload] Auth token preview:', accessToken.substring(0, 50) + '...');
    console.log('[Gamefolio Upload] Platform:', Platform.OS);

    try {
      // Generate filename
      let filename = fileUri.split('/').pop() || `${uploadType}_${Date.now()}.mp4`;
      if (fileUri.startsWith('blob:') || fileUri.startsWith('ph://')) {
        filename = `${uploadType}_${Date.now()}.mp4`;
      }
      
      // Determine MIME type - prefer asset's mimeType, fallback to extension detection
      let filetype = assetMimeType || 'video/mp4';
      if (!assetMimeType) {
        const uriLower = fileUri.toLowerCase();
        if (uriLower.endsWith('.mov')) {
          filetype = 'video/quicktime';
        } else if (uriLower.endsWith('.webm')) {
          filetype = 'video/webm';
        } else if (uriLower.endsWith('.m4v')) {
          filetype = 'video/x-m4v';
        }
      }
      
      // Ensure filename has correct extension based on MIME type
      if (filetype === 'video/quicktime' && !filename.toLowerCase().endsWith('.mov')) {
        filename = filename.replace(/\.[^/.]+$/, '') + '.mov';
      } else if (filetype === 'video/mp4' && !filename.toLowerCase().endsWith('.mp4')) {
        filename = filename.replace(/\.[^/.]+$/, '') + '.mp4';
      }

      // STEP 1: Upload video file
      console.log('[Gamefolio Upload] Step 1: Upload video file');
      console.log('[Gamefolio Upload] Endpoint:', `${GAMEFOLIO_REST_API}/upload/video-direct`);
      console.log('[Gamefolio Upload] Filename:', filename);
      console.log('[Gamefolio Upload] Filetype:', filetype);
      
      const formData = new FormData();
      const fileEntry = await createFileEntry(fileUri, filename, filetype);
      formData.append('file', fileEntry);
      formData.append('uploadType', uploadType);
      formData.append('filename', filename);
      formData.append('filetype', filetype);

      const uploadResponse = await fetch(`${GAMEFOLIO_REST_API}/upload/video-direct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        await handleUploadError(uploadResponse, 'Video upload');
      }

      const uploadResult = await uploadResponse.json() as VideoUploadStep1Response;
      console.log('[Gamefolio Upload] Step 1 completed:', uploadResult);

      if (!uploadResult.success || !uploadResult.result?.url || !uploadResult.result?.path) {
        throw new Error('Invalid response from video upload: missing url or path');
      }

      // STEP 2: Process video with metadata
      console.log('[Gamefolio Upload] Step 2: Process video with metadata');
      console.log('[Gamefolio Upload] Endpoint:', `${GAMEFOLIO_REST_API}/upload/process-video`);
      
      const processBody: Record<string, unknown> = {
        uploadResult: {
          url: uploadResult.result.url,
          path: uploadResult.result.path,
        },
        title: data.title,
        description: data.description || '',
        gameId: parseInt(data.gameId, 10) || data.gameId,
        tags: data.tags || [],
        videoType: uploadType,
        ageRestricted: data.ageRestricted || false,
      };
      
      // Add trim parameters if provided
      if (data.trimStart !== undefined && data.trimStart > 0) {
        processBody.trimStart = data.trimStart;
      }
      if (data.trimEnd !== undefined && data.trimEnd > 0) {
        processBody.trimEnd = data.trimEnd;
      }
      
      console.log('[Gamefolio Upload] Process body:', JSON.stringify(processBody, null, 2));

      const processResponse = await fetch(`${GAMEFOLIO_REST_API}/upload/process-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(processBody),
      });

      if (!processResponse.ok) {
        await handleUploadError(processResponse, 'Video processing');
      }

      const processResult = await processResponse.json() as VideoUploadStep2Response;
      console.log('[Gamefolio Upload] Step 2 completed:', processResult);

      return {
        success: true,
        id: processResult.id,
        shareCode: processResult.shareCode,
        shareUrl: processResult.shareUrl,
        xpGained: processResult.xpGained,
        userXP: processResult.userXP,
        userLevel: processResult.userLevel,
      };
    } catch (error) {
      console.error('[Gamefolio Upload] Error:', error);
      throw error;
    }
  },

  /**
   * Upload a screenshot (single-step process)
   * POST /api/upload/screenshot with FormData
   */
  uploadScreenshot: async (
    fileUri: string,
    data: UploadData,
    accessToken: string
  ): Promise<ScreenshotUploadResult> => {
    console.log('[Gamefolio Upload] Starting screenshot upload');
    console.log('[Gamefolio Upload] File URI:', fileUri);
    console.log('[Gamefolio Upload] Data:', data);
    console.log('[Gamefolio Upload] Auth token length:', accessToken.length);
    console.log('[Gamefolio Upload] Auth token preview:', accessToken.substring(0, 30) + '...');
    console.log('[Gamefolio Upload] Endpoint:', `${GAMEFOLIO_REST_API}/upload/screenshot`);
    console.log('[Gamefolio Upload] Platform:', Platform.OS);

    try {
      let filename = fileUri.split('/').pop() || `screenshot_${Date.now()}.jpg`;
      if (fileUri.startsWith('blob:')) {
        filename = `screenshot_${Date.now()}.jpg`;
      }
      const uriLower = fileUri.toLowerCase();
      const filetype = uriLower.endsWith('.png') ? 'image/png' : 'image/jpeg';

      // Build FormData according to spec
      const formData = new FormData();
      const fileEntry = await createFileEntry(fileUri, filename, filetype);
      formData.append('screenshot', fileEntry);
      formData.append('title', data.title);
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.gameId) {
        formData.append('gameId', data.gameId);
      }
      formData.append('tags', JSON.stringify(data.tags || []));
      formData.append('ageRestricted', String(data.ageRestricted || false));

      console.log('[Gamefolio Upload] Sending screenshot upload request...');

      const response = await fetch(`${GAMEFOLIO_REST_API}/upload/screenshot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        await handleUploadError(response, 'Screenshot upload');
      }

      const result = await response.json() as ScreenshotUploadResponse;
      console.log('[Gamefolio Upload] Screenshot uploaded:', result);

      return {
        success: true,
        screenshotId: result.screenshot?.id || 0,
        xpGained: result.xpGained || 0,
        userXP: result.userXP || 0,
        userLevel: result.userLevel || 0,
      };
    } catch (error) {
      console.error('[Gamefolio Upload] Error:', error);
      throw error;
    }
  },
};

export type { GamefolioConversation, GamefolioMessage };
