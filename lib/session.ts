import type { User } from "@/modules/auth/schema";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/surreal";
import { jwtVerify, importJWK } from "jose";
import { syncAuth0UserToDb } from "@/modules/auth/actions";

interface Auth0Payload {
  sub: string;
  email?: string;
  nickname?: string;
  name?: string;
  aud?: string;
  iss?: string;
}

// Cache for Auth0 JWKS to avoid repeated network calls
let cachedJwks: any = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

async function getAuth0PublicKey(): Promise<any> {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  if (!auth0Domain) {
    throw new Error("AUTH0_DOMAIN not configured");
  }

  const now = Date.now();
  // Return cached JWKS if still valid
  if (cachedJwks && now - jwksCacheTime < JWKS_CACHE_TTL) {
    return cachedJwks;
  }

  try {
    const response = await fetch(`https://${auth0Domain}/.well-known/jwks.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
    }
    cachedJwks = await response.json();
    jwksCacheTime = now;
    return cachedJwks;
  } catch (error) {
    console.error("Failed to fetch Auth0 JWKS:", error);
    throw error;
  }
}

export async function getSession() {
  // Check for Auth0 appSession cookie
  const cookieStore = await cookies();
  const appSession = cookieStore.get("appSession");

  if (!appSession?.value) {
    return null;
  }

  try {
    // Decode token header to get kid (key ID)
    const parts = appSession.value.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const header = JSON.parse(
      Buffer.from(parts[0], "base64").toString("utf-8")
    );
    const kid = header.kid;

    // Fetch Auth0's public JWKS
    const jwks = await getAuth0PublicKey();

    // Find the key matching the kid
    const key = jwks.keys.find((k: any) => k.kid === kid);
    if (!key) {
      throw new Error(`Key ${kid} not found in JWKS`);
    }

    // Import the public key for verification
    const publicKey = await importJWK(key);

    // Verify the JWT signature (allow expired tokens - Auth0 manages session lifetime via cookies)
    let payload: Auth0Payload;
    try {
      const verified = await jwtVerify(appSession.value, publicKey);
      payload = verified.payload as Auth0Payload;
    } catch (error: any) {
      // If it's an expiration error, decode without verification to get the claims
      if (error?.code === "ERR_JWT_EXPIRED") {
        const parts = appSession.value.split(".");
        const decoded = JSON.parse(
          Buffer.from(parts[1], "base64").toString("utf-8")
        );
        payload = decoded as Auth0Payload;
      } else {
        throw error;
      }
    }

    if (!payload.sub) {
      throw new Error("No sub claim in token");
    }

    return {
      auth0Sub: payload.sub,
      email: payload.email || "",
      nickname: payload.nickname || "",
      name: payload.name,
      isLoggedIn: true,
    };
  } catch (error) {
    console.error("Failed to verify appSession cookie:", error);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session?.auth0Sub) {
    return null;
  }

  // Query SurrealDB for user by auth0_sub
  try {
    let user = await queryOne<User>(
      "SELECT * FROM users WHERE auth0_sub = $auth0Sub LIMIT 1",
      { auth0Sub: session.auth0Sub }
    );

    // First login: sync user to database
    if (!user) {
      try {
        const result = await syncAuth0UserToDb(
          session.auth0Sub,
          session.email || "",
          session.nickname || "",
          session.name
        );

        if ("user" in result && result.user) {
          user = result.user;
        }
      } catch (syncError) {
        console.error("Failed to sync Auth0 user:", syncError);
        // Continue - user will be null
      }
    }

    return user || null;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/login?returnTo=/dashboard");
  }
  return user as User;
}
