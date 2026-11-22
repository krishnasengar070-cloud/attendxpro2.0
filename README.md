# AttendX Pro

AttendX Pro records QR attendance for scheduled classes. Administrators manage institutions and academic records, teachers open live sessions, and students check in with their own verified accounts.

## Run the application locally

Install Node.js 24.11 or later on the Node 24 line. Extract this project, open a terminal in the folder containing `package.json`, and run:

```sh
npm run local
```

Open [localhost:3000](http://localhost:3000). The local runtime creates a persistent SQLite database and private development signing keys in `.attendx/`. Its frontend libraries, QR decoder, charts, fonts, WebSocket implementation, and export writers are included. This mode works without installing npm packages. Keep its terminal open while using the application.

### Development accounts

Institution code: `northbridge`. Shared **local development password**: `AttendX-local-2026!`. On the local sign-in page, choosing a role fills its credentials, then **Sign in** authenticates against the database.

| Role | Email |
| --- | --- |
| Admin | `admin@attendx.test` |
| Teacher | `teacher@attendx.test` |
| Student | `student@attendx.test` |

The fixtures contain 24 students, four teachers, four classes, and historical meetings. **Systems Studio** has an all-day development timetable so a teacher can try a session at any hour. Its session window is 15 minutes. The QR rotates every 20 seconds and check-ins become late after five minutes. Each scheduled meeting can be opened once per institution-local day.

### Try a complete check-in

1. Sign in as the teacher. Choose **Start session → Systems Studio → Start session**.
2. Open a separate browser profile or private window and sign in as the student. Use **Scan class QR** to scan the teacher’s display. On one computer, take a screenshot of the displayed QR and select the screenshot using **QR image** while the code is current. The scanner accepts PNG, JPEG, or WebP. A screenshot of the current QR works.
3. The student receives the status and timestamp. The teacher’s roster updates immediately. Repeating a valid scan returns the original check-in.
4. End the session. Remaining students become absent. A student can choose a completed record in **Attendance history** and request a correction. The teacher can review it in **Corrections**.
5. Open **Reports**, select filters and a report type, then download a PDF, XLSX, or CSV.

The local server listens on loopback. For two physical devices, use the HTTPS deployment below with a hostname both devices can reach. A phone’s own `localhost` addresses that phone. In local mode, verification and reset links are available from the development mailbox:

```sh
npm run mail
```

## Next.js and PostgreSQL development

Requirements are Node.js 24.11+, npm, Docker with Compose, and network access to download dependencies and images. Use a different port or stop the local server before running Next.js on port 3000.

```sh
node scripts/configure-dev.mjs
docker compose up -d --wait
npm install
npm run migrate
docker compose exec -T postgres psql -U attendx_migrate -d attendx -c "REVOKE ALL ON TABLE public._prisma_migrations FROM attendx_app"
npx prisma generate
npm run seed
npm run dev
```

In a second terminal in the same folder:

```sh
npm run worker
```

Open [localhost:3000](http://localhost:3000). The local SMTP inbox is at [localhost:8025](http://localhost:8025). The configuration helper creates random database passwords and signing keys in `.env`. It preserves an existing configuration. The PostgreSQL seed requires explicit development opt-in and refuses to run in production. The same sample logins work after seeding. The runtime DB role has DML privileges. The migration owner has separate credentials.

## Architecture and source layout

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js App Router pages, API route handler, loading and error states |
| `components/` | TypeScript application shell, Radix/shadcn-style dialog, local HTML entry |
| `public/ui/` | Shared React views, role navigation, forms, calendar, camera scanner, and live roster |
| `public/` | Responsive design system, fonts, PWA manifest, offline page and service worker |
| `lib/` | Authentication, tenant authorization, scheduling, QR signing, check-in transactions, analytics, exports, jobs, and WebSockets |
| `prisma/` | Normalized Prisma schema and ordered PostgreSQL SQL migrations |
| `scripts/` | Local runtime, account provisioning, fixture seeding, worker, and key rotation |
| `deploy/` | PostgreSQL role initialization and runtime privilege grants |
| `tests/` | Service integration tests, database concurrency checks, and browser workflows |
| `vendor/` | Redistributable dependencies and license notices used by the portable runtime |

The hosted target uses Next.js 16, React 19, TypeScript, Tailwind 4, Framer Motion, Radix, Lucide, Prisma 7, and PostgreSQL. The shared React views use browser-native JavaScript modules and HTM so the portable runtime can use the same components without a build step. That runtime ships React 18, native accessible dialogs, and SQLite. Chart.js supplies interactive charts. The authentication implementation uses opaque, revocable server sessions. A dedicated Node worker handles WebSockets, database notifications, timers, and delivery jobs. These choices keep the Next.js frontend deployable independently.

## Portals and features

| Portal | Major workflows |
| --- | --- |
| Administrator | Institution metrics, user invitations and status, role and permission changes, course structure, class assignments, enrollments, timetables, holidays, device approvals, deletion requests and audit history |
| Teacher | Assigned classes and schedules, timed rotating QR, live roster, late indicators, manual changes with reasons, correction reviews, announcements, class exports |
| Student | Camera and image scanning, private attendance history, subject rates, calendar, missed classes, branded digital ID, notifications, correction requests, device registration |
| Reports | Record detail, daily and monthly summaries, class, subject, department and student summaries, and low-attendance lists. Filters cover dates, status, student, class, subject and department |
| Analytics | Daily, weekly and monthly trends, threshold comparisons, absence by weekday, lateness, class rankings, next-miss projections and classes needed to reach target |

Staff can browse past session rosters by class and status. The attendance calendar shows separate present, late, and absent counts for each date, with paginated records for busy days. Administrators can invite and manage other administrators. Registered devices can be removed by their owners or an institution administrator. Attendance alerts and target projections use the underlying counts before display rounding.

Charts export as PNG. CSV and Excel preserve Unicode text. PDF includes Latin and Devanagari fonts and supports an institution-supplied font via `REPORT_FONT_PATH`. Records exports have a 10,000-row limit per request. Apply narrower date or class filters for larger datasets.

## Test commands

```sh
npm test
npm install
npx playwright install chromium
npm run test:browser
```

`npm test` runs the core suite on newly created databases. To run it against disposable, already-migrated PostgreSQL, set `ATTENDX_TEST_PG=1`, `DATABASE_URL` and `LISTEN_DATABASE_URL` in the process environment. Use a test database, since the suite creates institutions and fixture records. The included CI workflow builds the Next.js project and runs the PostgreSQL and Chromium suites. It also starts the compiled Next.js server and live worker, signs in as a teacher and student, submits a signed QR against PostgreSQL, checks WebSocket delivery, closes the roster, and downloads a PDF.

The browser tests exercise the actual HTTP handlers and WebSocket server over local IPC. They use separate authenticated browser contexts and feed a rendered session QR into a camera test stream. This tests decoding, submission, confirmation, and roster updates. Physical cameras, native PWA installation prompts, and external provider delivery require device or deployment checks.

## Deploy

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for environment values, migration order, Vercel and container deployment, worker configuration, and commissioning checks. [SECURITY.md](SECURITY.md) describes data boundaries, QR replay protection, privacy and key rotation. No live hosting account or paid provider is required for portable local use.
