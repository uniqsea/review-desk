import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

const SESSION_COOKIE = "review_session";
const SESSION_DAYS = 30;

function sessionExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DAYS);
  return date.toISOString();
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const now = new Date().toISOString();
  const [session] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      displayName: users.displayName,
      email: users.email,
      role: users.role
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  return session ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function createSession(userId: string) {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = sessionExpiry();

  db.insert(sessions).values({ id, userId, createdAt, expiresAt }).run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const db = getDb();
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  }
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });
}

export async function loginWithUserId(userId: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  await createSession(user.id);
  return user;
}

export async function createUser({
  displayName
}: {
  displayName: string;
}) {
  const db = getDb();
  const createdAt = new Date().toISOString();
  const trimmedName = displayName.trim();

  const userId = randomUUID();
  db.insert(users).values({
    id: userId,
    displayName: trimmedName,
    email: null,
    passwordHash: null,
    role: "reviewer",
    createdAt,
    updatedAt: createdAt
  }).run();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user!;
}

export async function updateUser({
  userId,
  displayName
}: {
  userId: string;
  displayName: string;
}) {
  const db = getDb();
  const trimmedName = displayName.trim();

  if (!trimmedName) {
    throw new Error("Display name is required");
  }

  db.update(users)
    .set({
      displayName: trimmedName,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, userId))
    .run();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

export async function deleteUser(userId: string) {
  const db = getDb();
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
  db.delete(users).where(eq(users.id, userId)).run();
}

export async function listUsers() {
  const db = getDb();
  return db.select().from(users).orderBy(users.displayName);
}
