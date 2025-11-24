// SurrealDB user type definitions
// Schema is defined in scripts/init-surreal-schema.ts

export interface User {
  id: string | unknown; // SurrealDB record ID: RecordId object or string (users:ID_VALUE)
  auth0_sub: string; // Auth0 user ID (e.g., "auth0|...")
  email: string;
  username: string; // Auth0 nickname/username
  name?: string;
  created_at: string;
}

export type NewUser = Omit<User, "id" | "created_at">;

// Extract ID from SurrealDB record ID (e.g., "users:abc123" → "abc123")
export function getUserIdFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  return idStr.replace("users:", "");
}

// Build SurrealDB record ID from ID
export function userRecordId(id: string | undefined): string {
  if (!id) throw new Error("User ID is required");
  const idStr = String(id);
  return idStr.startsWith("users:") ? idStr : `users:${idStr}`;
}
