// SurrealDB user type definitions
// Schema is defined in lib/surreal.ts initSchema()

export interface User {
  id: string; // SurrealDB record ID: users:xxx
  username: string;
  password: string; // bcrypt hashed
  created_at: string;
}

export type NewUser = Omit<User, "id" | "created_at">;

// Extract numeric ID from SurrealDB record ID (e.g., "users:abc123" → "abc123")
export function getUserIdFromRecord(recordId: string): string {
  return recordId.replace("users:", "");
}

// Build SurrealDB record ID from ID
export function userRecordId(id: string): string {
  return id.startsWith("users:") ? id : `users:${id}`;
}
