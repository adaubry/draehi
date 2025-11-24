"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // Check if Auth0 is configured
    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;

    if (auth0Domain) {
      // Redirect to Auth0 login
      window.location.href = "/api/auth/login";
    } else {
      // Development mode: show message
      const message = "Auth0 not configured. Set AUTH0_DOMAIN and related env vars to enable authentication.";
      document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5;">
          <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 500px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 1rem 0; font-size: 24px;">Sign in to Draehi</h1>
            <p style="color: #666; margin: 0;">Deploy your Logseq graph to the web</p>
            <div style="margin-top: 2rem; padding: 1rem; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404;">
              <p>${message}</p>
              <p style="font-size: 14px; margin: 1rem 0 0 0;">See .env.example for configuration details.</p>
            </div>
          </div>
        </div>
      `;
    }
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f5f5" }}>
      <div style={{ background: "white", padding: "2rem", borderRadius: "8px", maxWidth: "500px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <h1 style={{ margin: "0 0 1rem 0", fontSize: "24px" }}>Sign in to Draehi</h1>
        <p style={{ color: "#666", margin: "0" }}>Redirecting...</p>
      </div>
    </div>
  );
}
