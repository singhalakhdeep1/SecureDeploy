# SecureDeploy: Security Compliance & Deployment Approval Platform

SecureDeploy ingests security scan results from CI/CD and in-cluster scanners and normalizes them into one finding model. It maps findings to regulatory controls (DPDP Act, RBI Cybersecurity Framework, ISO 27001, SOC 2) and gates deployments on open critical findings, with an exception workflow and an audit trail. It also produces PDF compliance reports.

**Stack:**
- Backend: NestJS 11 (TypeScript), PostgreSQL 16 with Prisma, Redis
- Frontend: Next.js 14 (App Router, TSX, Recharts)
- Scanners: Grype, Syft, Trivy (in the API image)
- In-cluster tooling: Kubernetes manifests for Grype, Syft, kube-bench, Falco and OPA Gatekeeper

```
CI pipeline (grype/trivy/semgrep/trufflehog/npm audit) ─┐            ┌─ Grype / Syft / kube-bench CronJobs
                                                        ▼            ▼
                          POST /api/webhooks/*  (X-Webhook-Secret or HMAC signature, rate limited)
                                                        │
          ┌──────────── NestJS API (JWT + RBAC, throttling, correlation-id logging, audit) ────────────┐
          │ findings: normalize → fingerprint dedupe → reopen regressions → auto-resolve (full scans)  │
          │ compliance: rule engine maps findings → controls; control-based scores (Redis cached)      │
          │ approvals: gate (open CRITICAL blocks) → exception → approve/reject → deployed/rollback    │
          │ reporting: PDF (pdfkit) stored in Postgres · scans: grype/trivy/syft · SBOM store · audit   │
          └───────────────────────────── PostgreSQL · Redis ───────────────────────────────────────────┘
                                                        ▲
                                  Next.js dashboard (findings, approvals, compliance, reports, scans, audit, users)
```

## Features

- **Ingestion and normalization.** Native JSON parsers for Trivy (vulnerabilities, misconfigurations, secrets), Grype, Semgrep, TruffleHog, npm audit, kube-bench and Falco, or pre-normalized findings from any tool.
  - Each finding gets a fingerprint for deduplication. A resolved finding that is reported again is reopened.
  - With `fullScan`, open findings the tool no longer reports are auto-resolved.
- **Compliance mapping.** A 20-control catalog across the four frameworks. A rule engine maps each finding by category, severity and keywords (injection, PII, auth) to controls with a risk score.
  - A control is compliant when it has no open mapped finding.
  - Scores are available per framework and per service. Security leads can add manual mappings.
- **Deployment approvals:**
  - Any open CRITICAL finding for the service and environment rejects the request at the gate. Optionally, too many HIGH findings do too (`DEPLOY_MAX_HIGH_FINDINGS`).
  - A security lead can grant an exception covering every open critical finding, with a justification. The deployment then goes back to PENDING.
  - Approve and reject are limited to ADMIN and SECURITY_LEAD. Segregation of duties applies: nobody approves their own request.
  - Approval re-checks the gate. Releases are then marked deployed and can be rolled back.
  - Pipelines can request a deployment, poll for the decision, and report the deploy over webhooks.
- **Access control:**
  - ADMIN: full access, plus user, role and service-ownership management.
  - SECURITY_LEAD: all findings, ingest, decisions, scans.
  - DEVELOPER: sees only owned services. Can move their own findings to IN_PROGRESS or RESOLVED.
  - AUDITOR: read-only, plus reports and the audit trail.
  - The first registered account becomes ADMIN.
- **Reporting.** PDF compliance report per framework, period and optional service: executive summary, PASS/FAIL per control, and mapped findings. The PDF is stored and downloadable.
- **Dashboard.** Open and resolved counts, MTTR overall and per severity, 30-day new-vs-resolved trend, compliance per framework, open findings per service, pending approvals.
- **Scans and SBOMs.** `/api/scans/{grype,trivy,sbom}` run the CLIs. Image references are strictly validated, so nothing else reaches the shell. With a service set, results are ingested as findings. SBOMs (SPDX, Syft, CycloneDX) are stored with component counts.
- **HLD/LLD patterns** (see [SECUREDEPLOY_HLD_LLD.md](SECUREDEPLOY_HLD_LLD.md)):
  - Redis cache with get-or-set and pattern invalidation.
  - Redis token-bucket rate limiter, an atomic Lua script, used on webhooks.
  - Structured JSON logging with correlation IDs, plus audit events persisted to `audit_events`.
  - Retry, circuit breaker and timeout policies, used around scanner runs.

## Quick start (Docker)

```bash
cp .env.example .env    # set JWT_SECRET and WEBHOOK_SECRET
docker compose up --build
```

- Frontend: http://localhost:3000. Register first; the first account is the admin.
- API: http://localhost:3001/api
- OpenAPI docs: http://localhost:3001/api/docs

The backend container applies migrations on start.

## Local development

You need Node 20+, PostgreSQL and (optionally) Redis.

```bash
cd backend
cp ../.env.example .env          # edit DATABASE_URL, JWT_SECRET, WEBHOOK_SECRET
npm install                      # also runs prisma generate
npx prisma migrate deploy        # migrations live in database/migrations
npm run prisma:seed              # optional demo users (one per role) + sample findings
npm run start:dev                # http://localhost:3001/api

cd ../frontend
npm install
npm run dev                      # http://localhost:3000
```

The seed creates `admin@`, `lead@`, `dev@` and `auditor@securedeploy.local`. Their password is `SEED_PASSWORD` (default `ChangeMe123!`).

## Sending scan results

```bash
trivy image -f json -o trivy.json my-app:1.4.0
jq -n --slurpfile raw trivy.json '{tool:"trivy", scanId:"build-812", service:"payments-api", environment:"production", fullScan:true, raw:$raw[0]}' |
  curl -X POST http://localhost:3001/api/webhooks/findings \
    -H "Content-Type: application/json" -H "X-Webhook-Secret: $WEBHOOK_SECRET" --data-binary @-
```

Full API reference: [docs/api-documentation.md](docs/api-documentation.md). Architecture: [docs/architecture.md](docs/architecture.md). Deployment: [docs/deployment-guide.md](docs/deployment-guide.md).

## Kubernetes security tooling

| Path | What it does |
|---|---|
| `grype/` | Nightly CronJob scans `IMAGE_REF` and posts the results to `/api/webhooks/findings` |
| `syft/` | Nightly CronJob builds an SBOM and posts it to `/api/webhooks/sbom` |
| `kube-bench/` | CIS benchmark CronJob; FAIL/WARN results become misconfiguration findings |
| `k8s/scanner-integration.yaml` | SecureDeploy URL, service/environment names and webhook Secret used by the jobs |
| `falco/` | Runtime detection DaemonSet and custom rules |
| `opa/` | Gatekeeper constraint templates (required labels, disallowed tags) and `policies/no-root.rego` |

## CI

`.github/workflows/ci.yml`:
1. Backend typecheck, build and the existing Jest spec.
2. Prisma migration plus a schema-drift check against Postgres.
3. Frontend build.
4. Docker image builds and compose validation.

`.github/workflows/security.yml` scans the image with Grype, Syft and Trivy, runs OPA, and posts the Grype results to SecureDeploy when the `SECUREDEPLOY_URL` and `SECUREDEPLOY_WEBHOOK_SECRET` secrets are set.

## Verification

Run on a dev machine against PostgreSQL 18 and Redis 7.
- **API:**
  - health check
  - register and login (first user becomes admin), role change
  - webhook ingest of raw Grype output (7 control mappings), wrong-secret 401
  - deduplication on re-ingest
  - stats and compliance score
  - gate rejection on a critical finding → exception → self-approval 403 → lead approval → deployed via webhook
  - PDF report generated and downloaded
  - shell-injection image reference rejected
  - unauthenticated 401, audit trail
- **Migration:** applied, no drift against the schema.
- **Existing tests:** the `scans.service.spec.ts` suite passes (5/5).
- **Browser (Edge):** 10 of 11 checks passed:
  - login redirect, dashboard, findings list and detail, status change
  - deployment request
  - compliance controls
  - PDF download
  - role-based navigation
  - The audit-trail check failed because of a stale-table race in the test script; the audit API itself returned events.

**Not run here:**
- the Docker images and compose stack (no Docker daemon)
- the scanner CLIs themselves (`/api/scans/*` needs grype, syft or trivy on the host)
- the Kubernetes manifests (only YAML validity was checked)

## License

MIT
