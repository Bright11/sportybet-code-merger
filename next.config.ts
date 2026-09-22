import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //  turbopack: {
  //   root: process.cwd(),
  // },
  
  // // 2. Clear dev-server blocking for ngrok and your local Wi-Fi IP (Top-Level)
  // allowedDevOrigins: [
  //   '*.ngrok-free.app',
  //   'localhost',
  //   '192.168.193.58'
  // ],

  // // 3. Clear Server Actions security block for production/dev tunnels
  // experimental: {
  //   serverActions: {
  //     allowedOrigins: ['*.ngrok-free.app'],
  //   },
  // },
};

export default nextConfig;
