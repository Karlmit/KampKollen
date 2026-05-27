export const config = {
  port: parseInt(process.env.PORT ?? '7666', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'dev_jwt_secret_change_in_production',
  cookieSecret: process.env.COOKIE_SECRET ?? 'dev_cookie_secret_change_in_prod',
  databaseUrl: process.env.DATABASE_URL ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:7666',
  azure: {
    imageEndpoint: process.env.AZURE_AI_IMAGE_ENDPOINT ?? '',
    imageApiKey: process.env.AZURE_AI_IMAGE_API_KEY ?? '',
    imageModel: process.env.AZURE_AI_IMAGE_MODEL ?? 'MAI-Image-2e',
    imageApiVersion: process.env.AZURE_AI_IMAGE_API_VERSION ?? 'preview',
  },
  uploadsDir: process.env.UPLOADS_DIR ?? '/app/uploads',
  isDev: process.env.NODE_ENV !== 'production',
}
