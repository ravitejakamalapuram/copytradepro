export const validateEnv = (): void => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'NODE_ENV',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n📝 Please create a .env file with the required variables.');
    process.exit(1);
  }

  console.log('✅ Environment variables validated successfully');
};
