---
name: Mobile API authentication
description: The durable boundary between Expo Clerk sessions and the shared authenticated API.
---

Native Expo clients cannot depend on the web app's session cookies. They must supply the current Clerk session token through the generated API client's auth-token getter, while using the runtime development domain as the API base URL.

**Why:** The shared API protects writes and backup operations with authentication, and cookies from the browser are not automatically available in a native client.

**How to apply:** When adding authenticated mobile screens, keep the Clerk session-to-bearer bridge in the root layout and use the generated API client rather than inventing per-screen fetch logic.