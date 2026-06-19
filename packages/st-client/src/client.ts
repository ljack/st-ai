import fs from 'fs';
import path from 'path';
import { USER_AGENT } from './auth/keys.js';
import { generateTOTP, signParams, generateRandomSalt } from './auth/crypto.js';
import {
  RemoteUserSession,
  RemoteUser,
  FollowCounts,
  RemoteSyncedWorkout,
  WorkoutList,
  WorkoutStats,
  AskoResponse
} from './types.js';

export class SportsTrackerClient {
  private baseURL: string;
  private sessionKey: string | null = null;
  private email: string | null = null;

  constructor(sessionKey: string | null = null, email: string | null = null, baseURL: string = 'https://api.sports-tracker.com/apiserver/v1/') {
    this.sessionKey = sessionKey;
    this.email = email;
    this.baseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  }

  getSessionKey(): string | null {
    return this.sessionKey;
  }

  getEmail(): string | null {
    return this.email;
  }

  private async request(
    method: string,
    endpoint: string,
    body: any = null,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const url = `${this.baseURL}${endpoint.replace(/^\//, '')}`;
    const reqHeaders: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en',
      ...headers
    };

    if (this.sessionKey) {
      reqHeaders['STTAuthorization'] = this.sessionKey;
    }

    let requestBody: any = body;
    if (
      body &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams) &&
      typeof body === 'object'
    ) {
      reqHeaders['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    const response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText || response.statusText}`);
    }

    return response;
  }

  private async decodeAsko<T>(response: Response): Promise<T> {
    const text = await response.text();
    let res: AskoResponse<T>;
    try {
      res = JSON.parse(text);
    } catch (err: any) {
      throw new Error(`Failed to parse ASKO response: ${err.message}. Raw output: ${text}`);
    }

    if (res.error) {
      throw new Error(`API Error (${res.error.code}): ${res.error.description}`);
    }

    return res.payload;
  }

  static async login(email: string, password: string, offsetMS: number = 0): Promise<SportsTrackerClient> {
    const totp = generateTOTP(email, offsetMS);
    const params = [
      { key: 'l', value: email },
      { key: 'p', value: password },
      { key: 'totp', value: totp }
    ];
    const signature = signParams('login2', params);
    const salt = generateRandomSalt();
    const ts = String(Date.now() + offsetMS);

    // Form encoded login request
    const formParams = new URLSearchParams();
    formParams.set('l', email);
    formParams.set('p', password);
    formParams.set('totp', totp);
    formParams.set('timestamp', ts);
    formParams.set('salt', salt);
    formParams.set('signature', signature);

    const client = new SportsTrackerClient();
    const response = await client.request('POST', 'login2', formParams, {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-login-email-verification-enabled': 'true'
    });

    const session = await response.json() as RemoteUserSession;
    if (!session.sessionkey) {
      throw new Error('Login failed: Server response did not contain a session key.');
    }

    return new SportsTrackerClient(session.sessionkey, email);
  }

  async logout(): Promise<void> {
    await this.request('GET', 'logout');
    this.sessionKey = null;
    this.email = null;
  }

  async whoami(): Promise<RemoteUser> {
    const response = await this.request('GET', 'user');
    return this.decodeAsko<RemoteUser>(response);
  }

  async getSettings(): Promise<any> {
    const response = await this.request('GET', 'user/settings');
    return this.decodeAsko<any>(response);
  }

  async getFollowCounts(): Promise<FollowCounts> {
    const response = await this.request('GET', 'user/follow');
    return this.decodeAsko<FollowCounts>(response);
  }

  async getUserByName(username: string): Promise<RemoteUser> {
    const response = await this.request('GET', `user/name/${username}`);
    return this.decodeAsko<RemoteUser>(response);
  }

  async listWorkouts(options: { since?: number; limit?: number; offset?: number } = {}): Promise<WorkoutList> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const since = options.since ?? 0;

    const endpoint = `workouts?since=${since}&limit=${limit}&offset=${offset}`;
    const response = await this.request('GET', endpoint);
    
    // Asko metadata holds the until cursor
    const text = await response.text();
    const res = JSON.parse(text) as AskoResponse<RemoteSyncedWorkout[]>;
    if (res.error) {
      throw new Error(`API Error (${res.error.code}): ${res.error.description}`);
    }

    const items = res.payload || [];
    const until = res.metadata?.until ?? 0;

    return { items, until };
  }

  async getWorkout(key: string): Promise<RemoteSyncedWorkout> {
    const response = await this.request('GET', `workouts/${key}`);
    return this.decodeAsko<RemoteSyncedWorkout>(response);
  }

  async getStats(username: string): Promise<WorkoutStats> {
    const response = await this.request('GET', `workouts/${username}/stats`);
    return this.decodeAsko<WorkoutStats>(response);
  }

  async exportFit(key: string): Promise<Buffer> {
    const response = await this.request('GET', `workout/exportFit/${key}`);
    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async exportGpx(key: string): Promise<Buffer> {
    const response = await this.request('GET', `workout/exportGpx/${key}`);
    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async deleteWorkout(key: string): Promise<void> {
    await this.request('DELETE', `workouts/${key}/delete`);
  }

  async uploadWorkout(smlPath: string, extensionsPath?: string): Promise<RemoteSyncedWorkout> {
    if (!fs.existsSync(smlPath)) {
      throw new Error(`SML file not found: ${smlPath}`);
    }

    const formData = new FormData();
    const smlContent = fs.readFileSync(smlPath);
    const smlBlob = new Blob([smlContent], { type: 'application/octet-stream' });
    formData.append('filePart', smlBlob, path.basename(smlPath));

    if (extensionsPath) {
      if (!fs.existsSync(extensionsPath)) {
        throw new Error(`Extensions file not found: ${extensionsPath}`);
      }
      const extContent = fs.readFileSync(extensionsPath);
      const extBlob = new Blob([extContent], { type: 'application/json' });
      formData.append('workoutExtensionsPart', extBlob, path.basename(extensionsPath));
    }

    // FormData headers are automatically set by fetch, do not override Content-Type manually
    const response = await this.request('POST', 'workout', formData);
    return this.decodeAsko<RemoteSyncedWorkout>(response);
  }
}
