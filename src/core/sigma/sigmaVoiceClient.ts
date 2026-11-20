import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface GenerativeStatus {
  isAvailable: boolean;
  modelName: string;
  backend: string;
  error?: string | null;
}

export interface StreamChunkPayload {
  token: string;
  finished: boolean;
}

export async function getGenerativeVoiceStatus(): Promise<GenerativeStatus> {
  try {
    return await invoke<GenerativeStatus>('generative_get_status');
  } catch (err) {
    return {
      isAvailable: false,
      modelName: 'None',
      backend: 'Unavailable',
      error: String(err),
    };
  }
}

export async function streamGenerativeVoice(
  prompt: string,
  onToken: (token: string) => void,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  let unlisten: UnlistenFn | undefined;
  let fullText = '';

  try {
    unlisten = await listen<StreamChunkPayload>('sigma-voice-chunk', (event) => {
      if (!event.payload.finished && event.payload.token) {
        fullText += event.payload.token;
        onToken(event.payload.token);
      }
    });

    const result = await invoke<string>('generative_synthesize_voice', {
      prompt,
      maxTokens: options?.maxTokens ?? 256,
      temperature: options?.temperature ?? 0.7,
    });

    return result || fullText;
  } finally {
    if (unlisten) unlisten();
  }
}
