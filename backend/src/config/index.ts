import 'dotenv/config';
import { envSchema } from './env-schema';
import { createConfig } from './config';

function loadAndValidateEnv() {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

const env = loadAndValidateEnv();
export const config = createConfig(env);

export type { AppConfig } from './config';
export { envSchema } from './env-schema';