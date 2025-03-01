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
};

export type SummaryMode = 'narrative' | 'bullet';
