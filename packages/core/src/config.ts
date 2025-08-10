import type { Config } from './types.js';

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  return value ? parseFloat(value) : defaultValue;
}

export function loadConfig(): Config {
  return {
    database: {
      url: getEnvVar('DATABASE_URL'),
    },
    s3: {
      endpoint: getEnvVar('S3_ENDPOINT'),
      bucket: getEnvVar('S3_BUCKET'),
      accessKey: getEnvVar('S3_ACCESS_KEY'),
      secretKey: getEnvVar('S3_SECRET_KEY'),
    },
    claude: {
      apiKey: getEnvVar('CLAUDE_API_KEY'),
    },
    confidence: {
      definitions: getEnvNumber('IFRS_CONFIDENCE_DEF', 0.85),
      claims: getEnvNumber('IFRS_CONFIDENCE_CLAIM', 0.8),
      functions: getEnvNumber('IFRS_CONFIDENCE_FUNC', 0.75),
    },
    maxQuoteChars: getEnvNumber('IFRS_MAX_QUOTE_CHARS', 300),
  };
}