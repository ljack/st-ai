import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CliConfig {
  sessionKey: string | null;
  email: string | null;
}

export function getConfigPath(): string {
  const home = os.homedir();
  return path.join(home, '.config', 'st-ai', 'config.json');
}

export function loadConfig(): CliConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { sessionKey: null, email: null };
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);
    return {
      sessionKey: data.sessionKey || null,
      email: data.email || null
    };
  } catch {
    return { sessionKey: null, email: null };
  }
}

export function saveConfig(sessionKey: string, email: string): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = { sessionKey, email };
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function clearConfig(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}
