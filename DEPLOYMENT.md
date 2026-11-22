# Deploying AttendX Pro

## Services

Run a Next.js Node application, a persistent Node worker, and a managed PostgreSQL database. Serve the application over HTTPS and the worker over WSS. A production environment starts with a new institution and an invitation for its administrator.

### Configuration

| Variable | Use |
| --- | --- |
| `APP_ORIGIN` | Exact public HTTPS origin, for example `https://attendance.example.edu`. This controls QR URLs, OAuth redirects and CSRF checks |
| `DATABASE_URL` | Runtime PostgreSQL connection. Use the restricted application role and TLS |
| `DIRECT_DATABASE_URL` | Migration-owner direct connection for Prisma CLI. Supply it to the migration job |
| `LISTEN_DATABASE_URL` | Direct non-transaction-pooled runtime connection for the worker’s PostgreSQL subscription |
| `APP_SECRET` | Independent, random 32-byte base64url key for protected authentication state |
| `QR_KEYS` | Comma-separated `keyId:base64urlSeed` values. The first Ed25519 key issues new QR codes |
| `REALTIME_URL`, `WORKER_PORT` | Public WSS endpoint ending in `/live`, and internal worker listening port |
| `DB_POOL_SIZE` | Maximum connections per Next.js or worker process. Default is five. Budget this against the database limit |
| `SMTP_URL`, `MAIL_FROM` | Authenticated SMTP URL and verified sender for verification, invitations, recovery, and opted-in notifications |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth web application credentials |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional Web Push credentials and operator contact URI |
| `TRUSTED_IP_HEADER` | Optional single-client-IP header. Configure only behind a controlled proxy that overwrites it for every request |
| `REPORT_FONT_PATH` | Optional operator-installed TTF for additional report scripts. Bundle the font with both the exporter and its license |

Generate each independent secret using the following command and load the results into the deployment’s secret manager.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Set `NODE_ENV=production` on the web and worker services. The web application requires an HTTPS `APP_ORIGIN` in production. The app declines requests when required signing keys are invalid. Development accounts are created only by the explicit fixture task.

### Database and institution

1. Create the database and separate migration-owner and runtime logins. The runtime login should be a non-superuser without role creation, database creation, or schema creation rights. The reference runtime role name is `attendx_app`.
2. Install dependencies on the build runner. Use `npm install` to resolve the supported ranges and generate a lockfile. Review and commit that lockfile before a production release, then use `npm ci`. Network restrictions prevented producing a validated lockfile in the delivery environment.
3. Set the database URLs and run `npm run migrate` using the migration owner. Run `deploy/runtime-grants.sql` as that owner. Reapply grants after subsequent migrations. Use a backup with a tested restore procedure before changing a live database.
4. Run `npm run build`. It generates Prisma Client before compiling Next.js.
5. Start the worker with `npm run worker`. Its `/health` endpoint reports whether it is subscribed to PostgreSQL. The web `/api/health` endpoint checks the database.
6. Configure SMTP and provision the first administrator through a trusted operator terminal:

```sh
npm run provision -- north-campus "North Campus Institute" Asia/Kolkata registrar@example.edu "Registrar"
```

The worker delivers the account setup link. The recipient sets their own password. Repeat provisioning with another unique code to create an isolated institution. Once signed in, create departments, courses, a batch and section, teachers, classes, students, enrollments, and recurring timetable meetings. Registration creates a student account. Administrators invite teachers and other administrators.

### Vercel web frontend

Import the source repository into Vercel, choose Next.js, select a supported Node 24 runtime, and supply the production variables. Run database migrations separately before directing traffic to a new build. `vercel.json` specifies installation and build commands. Deploy the worker on a persistent Node host with WebSocket upgrades and route `/live` to it. Point `REALTIME_URL` at that endpoint. Both services use the same institution database and application secrets. Set the worker’s allowed origin to the frontend through `APP_ORIGIN`.

### Container deployment

```sh
docker build -t attendx-pro .
docker run --env-file .env.production -p 127.0.0.1:3000:3000 attendx-pro
docker run --env-file .env.production -p 127.0.0.1:3001:3001 attendx-pro npm run worker
```

Put both ports behind a TLS reverse proxy. Forward WebSocket upgrades to the worker. Use the secret manager or your process supervisor for environment injection and restart policies. The bundled Compose file supplies a development PostgreSQL and mail inbox. A managed production setup can use the same schema.

### Optional provider setup

- **Email.** Configure SMTP with TLS and credentials for a verified sending domain. The worker leases outbox jobs, retries temporary failures with backoff, and scrubs sent message bodies. Monitor `delivery` rows with `status='Failed'`. On local SQLite, `npm run mail` exposes the development mailbox only to the machine operator.
- **Google.** Register `APP_ORIGIN/api/auth/google-callback` as the exact redirect URI. Sign-in uses state, PKCE, and the verified Google email to find an existing verified workspace account. Administrator accounts protected by TOTP use the password-and-code flow.
- **Web Push.** Generate a VAPID pair with `npx web-push generate-vapid-keys`. Configure both keys and the subject, then enable push from Profile & settings in a supported browser. In-app notifications work independently.
- **Campus checks.** Configure location, network CIDR, or approved devices in Institution settings. Start with a real enrolled test account. Document the institution’s purpose and consent process. Provide teacher-assisted attendance when permissions are denied.
- **Monitoring.** Collect structured stderr events, request references, and worker health. Alert on API and worker health failures, queued mail age, failed deliveries, database connection saturation, repeated rate limits and slow exports.

### Release verification

The supplied portable workspace passed service and browser tests against real SQLite transactions. This delivery environment could not install the npm production dependency graph or start a managed PostgreSQL instance. Run the included CI job and verify the deployed HTTPS origin, WSS reconnect, email verification/reset links, and device camera permissions in staging. Register one student in each of two test institutions and verify the independent rosters and report scopes. Load-test the institution’s largest expected class and peak concurrent check-in traffic before a campus rollout.

Reference documentation: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [Prisma with Next.js](https://www.prisma.io/docs/guides/frameworks/nextjs), [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
