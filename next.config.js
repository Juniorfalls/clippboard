/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@ffmpeg-installer/ffmpeg"],
    outputFileTracingIncludes: {
      "/api/inngest": [
        "./node_modules/@ffmpeg-installer/linux-x64/ffmpeg",
        "./node_modules/@ffmpeg-installer/darwin-x64/ffmpeg",
        "./node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg",
        "./node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe",
      ],
    },
  },
};

module.exports = nextConfig;
