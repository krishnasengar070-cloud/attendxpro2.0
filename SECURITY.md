# Attendance and security architecture

## Authorization

A successful sign-in generates a random 256-bit browser session token. The server stores its SHA-256 digest and expiry. Each authenticated call reloads the account’s active status, verified status, institution and role. Production cookies are host-only, Secure, HttpOnly, SameSite=Lax, and scoped to `/`. A session cookie lasts up to 12 hours. Remember me enables a 30-day persistent cookie. Password reset and logout-all revoke sessions. Role changes and deactivation also revoke existing sessions.

Passwords use salted scrypt with N=131072, r=8 and p=1. Expensive hashing is bounded per process. Independent database-backed windows limit sign-in attempts by workspace/account and IP. State-changing browser requests require an exact configured Origin and JSON content type. Account setup and reset links use one-time, hashed, expiring tokens. Outbound mail waiting for delivery contains a live link and must be protected with the same care as credential material.

Tables use tenant-scoped composite foreign keys and unique enrollment, session, and attendance constraints. API queries bind parameters and take the tenant from the authenticated identity. Teacher authorization checks current class assignments. Student history and exports filter by the student’s own account. Permissions are rechecked on mutations and report generation. The runtime database account has application-wide DML privileges, so the service layer is the tenant authorization boundary. A database-per-institution deployment is also possible for institutions requiring physical separation.

## Check-in sequence

1. The teacher opens an assigned class during its timetable interval. The server checks the institution time zone, holidays and active class membership, then snapshots active enrollments into pending attendance records.
2. Each session has a deadline, lateness cutoff, and rotation interval. The server issues short-lived QR codes in 10–30 second intervals. An Ed25519 signature binds the protocol version, key ID, nonce, institution, class, session, and expiry. The QR carries an opaque nonce and signature in the URL fragment.
3. A student signs in and scans. The server verifies the signature against its persisted token, rechecks the timetable and active enrollment, locks the session against closure, and validates any optional campus checks.
4. The transaction changes the student’s pending record to Present or Late, stores the timestamp, and creates the student notification. A composite unique constraint reserves one row per student per session. Repeated valid scans return the existing check-in. A posted correction takes precedence over subsequent scans.
5. WebSocket invalidations publish after commit. PostgreSQL NOTIFY delivers on commit across web instances. The worker consumes single-use 30-second tickets, verifies the exact browser origin, and rechecks authentication and class scope before sending an invalidation. Clients then fetch only their permitted data. A periodic refresh covers reconnects and notification gaps.
6. The worker finalizes expired sessions and assigns absences from the original roster. The submission path rejects expired tokens and sessions immediately using server time, even between worker ticks.

The shared classroom QR can be read by multiple enrolled students during its validity interval. Per-student idempotency and expiry protect against repeat marking and old captures. A currently valid image can be forwarded. GPS, a server-observed network, and an approved browser add signals while leaving physical presence subject to institutional policy. Digital ID QR payloads use a separate prefix and cannot enter the session check-in path.

## Privacy and operations

Camera frames and uploaded QR images are decoded in the browser. GPS coordinates, when required, are submitted once with consent, checked in memory, and discarded. IP rate-limit keys use a keyed digest. Device registration uses a random cookie and a user-supplied label. Staff can record a manual adjustment with a mandatory reason. React escapes user text and the server applies a Content Security Policy. Only public offline assets enter the service-worker cache. Attendance is confirmed only after an online server transaction.

Record edits, decisions, role changes, and administrative actions are audited. Calendar and reporting dates follow the institution’s time zone. Retention runs in the worker and purges old attendance, related correction records, notifications, delivery jobs, and audit data. Expired token, login and rate-limit rows are pruned separately. An administrator can review deletion requests and remove personal identifiers, login material, subscriptions, and enrollments. Historical attendance remains pseudonymous until the institution’s retention deadline. Institutions should review free-text notes, exported copies, and backups in their own privacy processes.

## Rotation

- Deploy a new QR key to every instance alongside the prior key, then make it first in `QR_KEYS`. Keep the previous verifier until every token issued with it has expired. Retire it across the entire fleet.
- For the application encryption key, first deploy support for the new key in `APP_PREVIOUS_SECRET` on all old-key instances. Roll services to the new `APP_SECRET` with the old key in `APP_PREVIOUS_SECRET`. Run `npm run rotate:totp` using the new configuration. Keep the previous key until outstanding ten-minute OAuth and five-minute setup challenges expire. Remove it from all instances. Rate-limit hashes change during rotation.
- SMTP, database, OAuth and VAPID credentials have separate rotation lifecycles. Changing VAPID keys can require browser re-subscription.

## Operational scope

The bundled worker handles timers, expiry warnings, missed-class alerts, threshold warnings after missed meetings, Sunday weekly summaries for active student records, delivery and retention. Weekly scheduling uses the institution’s local Sunday. Delivery is at least once across a crash between provider acceptance and the database update. The worker retries delivery with bounded backoff.

Keep production secrets out of source control and browser bundles. Limit access to the migration owner, use encrypted database connections and backups, set an institution-specific retention policy, and run the deployment tests with real provider credentials before inviting users.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [browser camera permission requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
