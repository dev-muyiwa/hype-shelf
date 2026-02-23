import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * Clerk webhook handler — syncs user records into Convex.
 *
 * Security (Rule 7): Every request is verified using the svix library
 * before any payload data is trusted or processed. An unverified
 * request is rejected with HTTP 400 — this prevents a malicious actor
 * from forging webhook events to write arbitrary user records into the
 * database (e.g., granting themselves admin role).
 *
 * The CLERK_WEBHOOK_SECRET must NEVER be set as a NEXT_PUBLIC_ variable.
 * It must remain server-only to prevent signature bypass.
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Extract svix signature headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing required svix headers", { status: 400 });
  }

  // Read the raw body as text for signature verification
  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid webhook signature", { status: 400 });
  }

  // Process user creation and update events
  if (evt.type === "user.created" || evt.type === "user.updated") {
    const {
      id,
      first_name,
      last_name,
      email_addresses,
      public_metadata,
    } = evt.data;

    // Role comes from Clerk's publicMetadata — set manually in the
    // Clerk dashboard, never from user-controlled input.
    const role =
      (public_metadata?.role as "admin" | "user") ?? "user";

    const name =
      [first_name, last_name].filter(Boolean).join(" ").trim() ||
      "Anonymous";

    const email = email_addresses[0]?.email_address ?? "";

    await fetchMutation(api.users.upsertUser, {
      clerkId: id,
      name,
      email,
      role,
    });
  }

  return new Response("OK", { status: 200 });
}
