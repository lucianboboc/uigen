/**
 * @vitest-environment node
 */
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock next/headers
const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

// Import auth functions after mocks
const { createSession, getSession, deleteSession, verifySession } = await import(
  "@/lib/auth"
);

// Mock cookie store
const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookies.mockResolvedValue(mockCookieStore);
});

// Helper to get JWT secret - ensure it's a proper Uint8Array
const getJWTSecret = (): Uint8Array => {
  const secret = process.env.JWT_SECRET || "development-secret-key";
  const encoder = new TextEncoder();
  const encoded = encoder.encode(secret);
  // Ensure it's actually a Uint8Array by creating a new one
  return new Uint8Array(encoded);
};

test("createSession creates a session with JWT token and sets cookie", async () => {
  const userId = "user-123";
  const email = "test@example.com";

  await createSession(userId, email);

  // Verify cookie was set
  expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
  const [cookieName, token, options] = mockCookieStore.set.mock.calls[0];

  expect(cookieName).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(token.length).toBeGreaterThan(0);

  // Verify cookie options
  expect(options.httpOnly).toBe(true);
  expect(options.secure).toBe(process.env.NODE_ENV === "production");
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);

  // Verify the token contains the correct payload
  const { payload } = await jwtVerify(token, getJWTSecret());
  expect(payload.userId).toBe(userId);
  expect(payload.email).toBe(email);
  expect(payload.expiresAt).toBeDefined();
});

test("createSession sets session expiry to 7 days from now", async () => {
  const now = Date.now();
  await createSession("user-123", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const expiryTime = options.expires.getTime();

  // Should expire approximately 7 days from now (within 1 second tolerance)
  const expectedExpiry = now + 7 * 24 * 60 * 60 * 1000;
  expect(expiryTime).toBeGreaterThanOrEqual(expectedExpiry - 1000);
  expect(expiryTime).toBeLessThanOrEqual(expectedExpiry + 1000);
});

test("getSession returns session payload when valid token exists", async () => {
  const userId = "user-123";
  const email = "test@example.com";
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Create a valid token
  const token = await new SignJWT({ userId, email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(getJWTSecret());

  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeDefined();
  expect(session?.userId).toBe(userId);
  expect(session?.email).toBe(email);
  expect(session?.expiresAt).toBeDefined();
});

test("getSession returns null when no token exists", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null when token is invalid", async () => {
  mockCookieStore.get.mockReturnValue({ value: "invalid-token" });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null when token verification fails", async () => {
  // Create a token with wrong secret
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({
    userId: "user-123",
    email: "test@example.com",
    expiresAt: new Date(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(wrongSecret);

  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null when token is expired", async () => {
  // Create an expired token
  const token = await new SignJWT({
    userId: "user-123",
    email: "test@example.com",
    expiresAt: new Date(Date.now() - 1000), // Already expired
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("0s") // Expire immediately
    .sign(getJWTSecret());

  mockCookieStore.get.mockReturnValue({ value: token });

  // Wait a bit to ensure expiration
  await new Promise((resolve) => setTimeout(resolve, 10));

  const session = await getSession();

  expect(session).toBeNull();
});

test("deleteSession deletes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledTimes(1);
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

test("verifySession returns session payload when valid token exists in request", async () => {
  const userId = "user-123";
  const email = "test@example.com";
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Create a valid token
  const token = await new SignJWT({ userId, email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(getJWTSecret());

  // Create a mock NextRequest with the token
  const request = new NextRequest("http://localhost:3000/api/test", {
    headers: {
      cookie: `auth-token=${token}`,
    },
  });

  const session = await verifySession(request);

  expect(session).toBeDefined();
  expect(session?.userId).toBe(userId);
  expect(session?.email).toBe(email);
  expect(session?.expiresAt).toBeDefined();
});

test("verifySession returns null when no token exists in request", async () => {
  const request = new NextRequest("http://localhost:3000/api/test");

  const session = await verifySession(request);

  expect(session).toBeNull();
});

test("verifySession returns null when token in request is invalid", async () => {
  const request = new NextRequest("http://localhost:3000/api/test", {
    headers: {
      cookie: "auth-token=invalid-token",
    },
  });

  const session = await verifySession(request);

  expect(session).toBeNull();
});

test("verifySession returns null when token verification fails", async () => {
  // Create a token with wrong secret
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({
    userId: "user-123",
    email: "test@example.com",
    expiresAt: new Date(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(wrongSecret);

  const request = new NextRequest("http://localhost:3000/api/test", {
    headers: {
      cookie: `auth-token=${token}`,
    },
  });

  const session = await verifySession(request);

  expect(session).toBeNull();
});

test("verifySession returns null when token in request is expired", async () => {
  // Create an expired token
  const token = await new SignJWT({
    userId: "user-123",
    email: "test@example.com",
    expiresAt: new Date(Date.now() - 1000),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("0s")
    .sign(getJWTSecret());

  const request = new NextRequest("http://localhost:3000/api/test", {
    headers: {
      cookie: `auth-token=${token}`,
    },
  });

  // Wait a bit to ensure expiration
  await new Promise((resolve) => setTimeout(resolve, 10));

  const session = await verifySession(request);

  expect(session).toBeNull();
});

test("verifySession handles requests with multiple cookies", async () => {
  const userId = "user-123";
  const email = "test@example.com";
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ userId, email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(getJWTSecret());

  const request = new NextRequest("http://localhost:3000/api/test", {
    headers: {
      cookie: `other-cookie=value; auth-token=${token}; another-cookie=value2`,
    },
  });

  const session = await verifySession(request);

  expect(session).toBeDefined();
  expect(session?.userId).toBe(userId);
  expect(session?.email).toBe(email);
});

test("session payload has correct structure", async () => {
  const userId = "user-123";
  const email = "test@example.com";

  await createSession(userId, email);

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { payload } = await jwtVerify(token, getJWTSecret());

  // Verify all required fields are present
  expect(payload).toHaveProperty("userId");
  expect(payload).toHaveProperty("email");
  expect(payload).toHaveProperty("expiresAt");

  // Verify types
  expect(typeof payload.userId).toBe("string");
  expect(typeof payload.email).toBe("string");
  expect(payload.expiresAt).toBeDefined();
});
