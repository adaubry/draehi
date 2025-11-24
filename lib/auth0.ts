// Auth0 configuration
// Routes are handled via /app/api/auth/* handlers
// This file contains configuration values for Auth0 integration

export const auth0Config = {
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  baseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
};
