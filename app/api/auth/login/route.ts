import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/dashboard";
  const screenHint = request.nextUrl.searchParams.get("screen_hint");

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
    redirect_uri: `${appBaseUrl}/api/auth/callback`,
    response_type: "code",
    scope: "openid profile email",
    ...(screenHint && { screen_hint: screenHint }),
  });

  if (returnTo) {
    params.set("state", Buffer.from(JSON.stringify({ returnTo })).toString("base64"));
  }

  return NextResponse.redirect(
    `https://${auth0Domain}/authorize?${params.toString()}`
  );
}
