import { z } from 'zod';

export const envSchema = z.object({
  // Server configuration
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // IMAP configuration
  IMAP_HOST: z.string().min(1, 'IMAP host is required'),
  IMAP_PORT: z.string().default('993').transform(Number),
  IMAP_USER: z.string().email('Valid email required for IMAP user'),
  IMAP_PASSWORD: z.string().min(1, 'IMAP password is required'),
  IMAP_SECURE: z.string().default('true').transform(val => val === 'true'),

  // Supabase configuration
  SUPABASE_URL: z.string().url('Valid Supabase URL required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anonymous key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Redis configuration
  REDIS_URL: z.string().url('Valid Redis URL required'),

  // Optional encryption key for sensitive data
  ENCRYPTION_KEY: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;