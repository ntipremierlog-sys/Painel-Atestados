import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://neondb_owner:npg_OEGPHuo29gfs@ep-round-grass-ayyjcquq-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require",
    NEXTAUTH_SECRET:
      process.env.NEXTAUTH_SECRET ||
      "X9$mK2#vQ8@nL5&pR1^wY4!jH7*cU3%eT6dF0sN",
    NEXTAUTH_URL:
      process.env.NEXTAUTH_URL ||
      "https://premier-atestados.vercel.app",
  },
};

export default nextConfig;
