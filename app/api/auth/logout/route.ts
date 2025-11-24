import { NextResponse } from "next/server";

export async function GET() {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  if (!auth0Domain || !clientId) {
    return NextResponse.json(
      { error: "Auth0 not configured" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    returnTo: appBaseUrl,
  });

  // Create redirect response
  const response = NextResponse.redirect(
    `https://${auth0Domain}/v2/logout?${params.toString()}`
  );

  // Clear the appSession cookie
  response.cookies.set("appSession", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Immediate expiration
    path: "/",
  });

  return response;
}
