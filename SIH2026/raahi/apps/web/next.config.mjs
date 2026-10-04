const VOICE_API = process.env.VOICE_API_URL || "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // The browser reaches the voice backend's officer and dashboard APIs through
  // this site (/voice-api/...), so the backend can stay on localhost and needs
  // no CORS. Only those two APIs are passed through.
  async rewrites() {
    return [
      { source: "/voice-api/officer/:path*", destination: `${VOICE_API}/officer/:path*` },
      { source: "/voice-api/admin/:path*", destination: `${VOICE_API}/admin/:path*` },
    ];
  },
};
export default nextConfig;
