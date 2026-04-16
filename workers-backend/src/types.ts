export type Env = {
  Bindings: {
    DB: D1Database
    IMAGES_BUCKET: R2Bucket
    SECRET_KEY: string
    AI_API_KEY: string
    CORS_ORIGINS: string
    AI_BASE_URL: string
    AI_MODEL: string
    CODE_REVIEW_CONTAINER: DurableObjectNamespace
    GITHUB_TOKEN: string
    GITHUB_WEBHOOK_SECRET: string
    OPENAI_API_KEY: string
    OPENAI_BASE_URL?: string
    OPENAI_MODEL?: string
  }
}
