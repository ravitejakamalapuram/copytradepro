/**
 * Validates required environment variables are set.
 * Throws an error if any required variable is missing.
 * @param requiredVars - Array of required environment variable names.
 */
export function validateEnv(requiredVars: string[]): void {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
