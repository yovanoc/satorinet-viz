import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    LIVECOINWATCH_API_KEY: z.string(),
    REDIS_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  client: {
    //
  },
  experimental__runtimeEnv: {
    //
  }
});
