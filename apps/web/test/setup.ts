import { plugin } from "bun";

plugin({
  name: "stub-server-only",
  setup(build) {
    build.module("server-only", () => ({
      contents: "",
      loader: "js",
    }));
  },
  target: "bun",
});

const seed = (key: string, value: string) => {
  process.env[key] = value;
};

seed("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef0123");
seed("BETTER_AUTH_URL", "http://localhost:3000");
seed("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
seed("S3_ACCESS_KEY_ID", "test-access-key");
seed("S3_BUCKET", "test-bucket");
seed("S3_ENDPOINT", "https://s3.example.test");
seed("S3_SECRET_ACCESS_KEY", "test-secret-key");
seed("REDIS_URL", "redis://localhost:6379");
