# HypeShelf

> Collect and share the stuff you're hyped about.

HypeShelf is a shared movie recommendations hub built as a take-home assessment for Fluence International. Authenticated users can add their favourite movies to a public shelf, filter by genre, and view real-time updates from everyone on the team.

---

## Features

- **Public shelf** — anyone can view the 3 most recent recommendations without signing in
- **Authenticated shelf** — sign in with Clerk to access full list with pagination
- **Search** — debounced search across title, blurb, and author name (server-side filtering)
- **Genre filtering** — filter by horror, action, comedy, drama, thriller, sci-fi, or other (server-side)
- **Sort order** — newest or oldest first
- **"My Picks" filter** — toggle to show only your own recommendations
- **Pagination** — cursor-based "Load More" pagination via Convex
- **Real-time updates** — the list updates instantly via Convex subscriptions when anyone adds or removes a recommendation
- **Staff Pick** — admins can designate exactly one recommendation as the Staff Pick at any time
- **Role-based access** — admin and user roles, enforced at the mutation layer
- **Rate limiting** — 30 requests per minute per user on all mutations
- **Error boundary** — graceful error recovery UI with retry option

---

## Architecture Decisions

### Why Convex for the backend?

Convex was chosen because it provides three things in one package: a real-time database with WebSocket subscriptions, a typed mutation/query system that runs on the server, and built-in auth integration. The alternative of building a separate REST API or using API Routes for every write would require significantly more boilerplate and would be harder to secure consistently. Convex's model forces all data access through typed, server-executed handlers, which aligns naturally with the principle that authorisation must live server-side.

### Clerk + Convex integration

Clerk handles user identity and session management. Convex handles data persistence and all backend logic. The two are wired together via `ConvexProviderWithClerk` (from `convex/react-clerk`), which automatically threads the Clerk JWT into every Convex query and mutation request.

When a user signs in, the Clerk JWT is sent to Convex with each request. Inside a mutation, `ctx.auth.getUserIdentity()` decodes and verifies the JWT, returning a `UserIdentity` with `subject` (the Clerk user ID) and other verified claims. The mutation can then look up the user in the Convex `users` table to resolve their role.

### Real-time updates

Convex's `useQuery` hook creates a WebSocket subscription to the query function. When any document matching the query changes (insert, update, delete), Convex pushes the updated result to all subscribed clients within milliseconds. There is no polling. The dashboard and public landing page both benefit from this.

### User sync via Clerk webhook

When a user is created or updated in Clerk, Clerk sends a webhook event to `/api/webhooks/clerk`. The handler verifies the request signature using `svix`, then calls the `upsertUser` Convex mutation to sync the user record (including their role from `publicMetadata`) into the Convex `users` table.

---

## Role System

### How roles are assigned

Roles are stored in Clerk's `publicMetadata` as `{ "role": "admin" }` or `{ "role": "user" }`. Setting the `admin` role requires access to the Clerk dashboard — there is no self-registration path for the admin role.

**To assign admin in the Clerk dashboard:**
1. Go to Clerk Dashboard → Users
2. Select the target user
3. Click "Edit public metadata"
4. Set `{ "role": "admin" }`
5. The next Clerk webhook event will sync this to the Convex `users` table

### How roles are enforced

Every write operation (add, delete, Staff Pick) is enforced at the Convex mutation layer:

1. The mutation calls `ctx.auth.getUserIdentity()` to verify the JWT.
2. Using `identity.subject` (the Clerk user ID from the verified token), it queries the Convex `users` table for the user's role.
3. The operation is allowed or rejected based on this server-resolved role.

**Why client-side checks are not sufficient:**

The React client is untrusted. A user with DevTools can call Convex mutations directly using the Convex client — they are not constrained to what the UI renders. If role enforcement only happened in the browser (e.g., by hiding the delete button), an admin-role user could be impersonated by anyone with network access. The mutation-layer check is the authoritative gate; the UI rendering is a UX convenience only.

---

## Security Decisions

| Rule | Implementation | Threat mitigated |
|------|---------------|-----------------|
| **Mutation-layer auth** | Every mutation begins with `ctx.auth.getUserIdentity()` check | Bypassed UI controls, direct API calls |
| **Role from identity token** | Role resolved from DB lookup using verified `identity.subject`, not client input | Role spoofing via tampered request body |
| **Auth before every action** | `if (!identity) throw new ConvexError("Unauthenticated")` | Unauthenticated writes |
| **URL protocol validation** | `validateUrl()` enforces `https:` or `http:` only, called inside mutation | XSS via `javascript:` or `data:` href injection |
| **Server-side input limits** | title ≤ 120, link ≤ 500, blurb ≤ 500, genre must be enum value — enforced in mutation | HTML maxlength bypass, oversized payloads |
| **Atomic Staff Pick** | Single mutation unsets existing pick then sets new one | Race condition allowing multiple Staff Picks |
| **Webhook signature verification** | `svix` verifies `svix-signature` header before trusting any payload | Forged webhook events granting arbitrary roles |
| **Environment variable discipline** | Secret keys never in `NEXT_PUBLIC_*` variables | Key exposure in client bundle |
| **Middleware route protection** | `clerkMiddleware` with `createRouteMatcher` guards `/dashboard(.*)` | Unauthenticated access to protected pages |
| **Public query data minimisation** | `getLatestRecommendations` returns only title, genre, addedByName, isStaffPick, createdAt | Internal ID and email leakage to public |
| **Public query limit** | Unauthenticated users receive max 3 items from `getLatestRecommendations` | Data exposure to unauthenticated users |
| **Rate limiting** | In-memory rate limiter, 30 requests/minute per user on all mutations | Spam, DoS, resource exhaustion |
| **Name sanitization** | `sanitizeName()` strips `<>` characters and limits to 100 chars | XSS via display name injection |

---

## Environment Variables

### Public (safe to expose to the browser)

These are read by the Next.js client bundle and are fine to be visible.

| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys | Initialises the Clerk client SDK |
| `NEXT_PUBLIC_CONVEX_URL` | Convex Dashboard → Settings | Convex WebSocket endpoint for queries |

### Private (must NEVER appear in `NEXT_PUBLIC_*`)

| Variable | Source | Why it must stay private |
|----------|--------|--------------------------|
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys | Full administrative access to your Clerk account. Exposure would allow an attacker to manage all users, sessions, and settings. |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard → Webhooks | Used to verify webhook signatures. Exposure would allow an attacker to forge webhook events and write arbitrary user records (including admin role) into your database. |

If any private key were placed in a `NEXT_PUBLIC_*` variable, Next.js would embed it in the client-side JavaScript bundle, making it visible to anyone who opens the browser DevTools network tab or views the page source.

---

## Local Setup

### Prerequisites

- Node.js 18+
- A Clerk account (free tier works)
- A Convex account (free tier works)

### 1. Clone and install

```bash
git clone <repo-url>
cd hype-shelf
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex
- Create a new Convex project
- Generate `convex/_generated/` (the typed API layer)
- Start the Convex backend in watch mode

Copy the `NEXT_PUBLIC_CONVEX_URL` printed in the terminal.

### 3. Set up Clerk

1. Create a new application at [clerk.com](https://clerk.com)
2. In the Clerk dashboard, go to **API Keys** and copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
3. Go to **Webhooks** and create a new endpoint:
   - URL: `https://<your-ngrok-or-deployed-url>/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`
   - Copy the **Signing Secret** as `CLERK_WEBHOOK_SECRET`

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in all four values.

### 5. Run the app

In one terminal (Convex backend — already running from step 2):
```bash
npx convex dev
```

In another terminal (Next.js):
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Set up an admin user (optional)

1. Sign up in the app to create a user account
2. In the Clerk dashboard, go to **Users** → select your user
3. Click **Edit public metadata** and set:
   ```json
   { "role": "admin" }
   ```
4. The next webhook event will sync this to Convex, giving you admin controls

---

## Known Limitations and Future Improvements

### `upsertUser` mutation visibility

The `upsertUser` mutation is currently a regular (public) Convex mutation. It is called exclusively from the webhook handler after svix signature verification, so it is safe in practice. However, it is technically callable by any Convex client.

In production, this should be refactored to an `internalMutation` and called from a Convex HTTP action (defined in `convex/http.ts`). This would make the function entirely invisible to browser clients and eliminate the exposure surface entirely. The webhook endpoint would then be the Convex HTTP action URL rather than the Next.js API route.

### Optimistic updates

Currently, adding a recommendation shows a loading state until the Convex mutation completes. Using Convex's `useMutation` with an optimistic update would make the UI feel instant.

### Role cache invalidation

Role changes in Clerk do not take effect until the next webhook event (`user.updated`). An admin could manually trigger a sync by updating any user field in the Clerk dashboard. A more immediate approach would be to read the role from the Clerk JWT directly (via a configured JWT template), though this adds JWT template configuration complexity.

As a fallback for local development or webhook failures, the `ensureUser` mutation is called on dashboard load to create user records with default `"user"` role if they don't exist.

### Rate limiting persistence

The current rate limiter is in-memory and resets on server restart. In production, this should use Redis or a dedicated rate limiting service for persistence across deployments.

### Search limitations

Search is performed in-memory after pagination because Convex doesn't support native `LIKE` queries. For large datasets, consider using Convex's full-text search feature or an external search service.

### Test coverage

Given the time constraints of the assessment, there are no automated tests. In a production codebase I would add:
- Unit tests for `validateUrl` and genre validation logic
- Integration tests for the Convex mutations (using Convex's testing library)
- E2E tests for the role boundary scenarios (unauthenticated, user, admin)
