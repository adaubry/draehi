import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  // Decode state to get returnTo URL
  let returnTo = "/dashboard";
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
      returnTo = decoded.returnTo || "/dashboard";
    } catch (e) {
      console.error("Failed to decode state:", e);
    }
  }

  try {
    // Exchange authorization code for tokens
    const auth0Domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    if (!auth0Domain || !clientId || !clientSecret) {
      console.error("Auth0 configuration missing for token exchange");
      return NextResponse.redirect(new URL("/?error=config", request.url));
    }

    const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${appBaseUrl}/api/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await tokenResponse.text());
      return NextResponse.redirect(new URL("/?error=token_exchange", request.url));
    }

    const tokens = await tokenResponse.json();

    // Create response with redirect
    const response = NextResponse.redirect(new URL(returnTo, request.url));

    // Set appSession cookie with id_token (JWT)
    // Auth0's @auth0/nextjs-auth0 SDK expects this cookie to contain the encoded session
    response.cookies.set("appSession", tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Auth0 callback error:", err);
    return NextResponse.redirect(new URL("/?error=callback", request.url));
  }
}
