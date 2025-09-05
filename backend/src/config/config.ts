import { envSchema, type Env } from './env-schema';

export interface AppConfig {
  server: {
    port: number;
    environment: 'development' | 'production' | 'test';
  };
  imap: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  redis: {
    url: string;
  };
  encryption?: {
    key: string;
  };
}

export function createConfig(env: Env): AppConfig {
  return {
    server: {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    imap: {
      host: env.IMAP_HOST,
      port: env.IMAP_PORT,
      user: env.IMAP_USER,
      password: env.IMAP_PASSWORD,
      secure: env.IMAP_SECURE,
    },
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    redis: {
      url: env.REDIS_URL,
    },
    encryption: env.ENCRYPTION_KEY ? { key: env.ENCRYPTION_KEY } : undefined,
  };
}