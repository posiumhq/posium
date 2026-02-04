import type { PlaywrightTestConfig } from '@playwright/test';
import 'dotenv/config'


const config: PlaywrightTestConfig = {
  testDir: './e2e',
  reporter: [
    ['html', {
      open: 'never',
    }],
    ['list'],
    ['./dist/index.js', {
      reportingApiBaseUrl: 'http://localhost:3002',  // Reporting API base URL
      runId: process.env.RUN_ID,          // Run ID (auto-generated if not set)
      serverKey: process.env.REPORTING_SERVER_KEY,  // Server key for internal authentication
      reportScreenshots: true,   // Upload screenshots (default: true)
      reportTraces: false,       // Skip traces to reduce upload time
      reportVideos: false,       // Skip videos to save storage
      logLevel: 3,               // Info level logging (default: 3)
    }],
  ],
  use: {
    // Enable traces and screenshots
    trace: 'on',
    screenshot: 'on',
  },
  // Enable retries to demonstrate retry handling
  retries: 2,
  // Add timeout for slower uploads
  timeout: 60000,
  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
    },
  ],
};

export default config;
