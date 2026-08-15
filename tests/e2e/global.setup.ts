import { FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("Setting up test environment...");
  console.log("Test database setup will be handled by backend");
  // The backend should recognize X-Test-Mode header and use a test database
  // Test data seeding should be handled via backend management commands
}

export default globalSetup;