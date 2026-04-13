export type Env = {
  Bindings: {
    DB: D1Database
    IMAGES_BUCKET: R2Bucket
    SECRET_KEY: string
    AI_API_KEY: string
    CORS_ORIGINS: string
    AI_BASE_URL: string
    AI_MODEL: string
  }
}
