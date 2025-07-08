export const config = {
  server: {
    name: 'deepsrt-mcp',
    version: '0.1.0',
  },
  api: {
    baseURL: 'https://worker.deepsrt.com',
    endpoints: {
      transcript: '/transcript',
    },
    defaults: {
      lang: 'zh-tw',
      mode: 'narrative' as const,
    },
  },
  images: {
    sizes: {
      thumbnail: { width: 320, height: 180 },
      medium: { width: 640, height: 360 },
      large: { width: 1280, height: 720 }
    },
    supportedTypes: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    cache: {
      enabled: true,
      ttl: 3600 // 1 hour in seconds
    },
    fallback: {
      thumbnail: 'https://via.placeholder.com/320x180',
      medium: 'https://via.placeholder.com/640x360',
      large: 'https://via.placeholder.com/1280x720'
    }
  }
};

export type SummaryMode = 'narrative' | 'bullet';
