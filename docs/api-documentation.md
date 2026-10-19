# SecureDeploy API Documentation

## Base URL

```
http://localhost:3001/api
```

Interactive OpenAPI docs: `http://localhost:3001/api/docs` (always matches the running code).

## Authentication

All endpoints require a JWT (`POST /api/users/login`) except login, register, health and `/api/webhooks/*` (webhook secret). Roles: `ADMIN`, `SECURITY_LEAD`, `DEVELOPER` (sees only owned services), `AUDITOR` (read-only). The first registered account becomes `ADMIN`.

```
Authorization: Bearer <token>
```

## Endpoints

### Findings

#### Ingest Scan Results
```http
POST /api/findings/ingest
Content-Type: application/json
Authorization: Bearer <token>

{
  "tool": "trivy",
  "scanId": "scan-123",
  "service": "api-service",
  "environment": "production",
  "findings": [
    {
      "severity": "critical",
      "title": "CVE-2023-1234",
      "description": "Critical vulnerability in dependency",
      "filePath": "package.json",
      "lineNumber": 10,
      "cveId": "CVE-2023-1234",
      "cvssScore": 9.8,
      "remediation": "Update to version 2.0.0"
    }
  ]
}
```

Instead of `findings`, send the scanner's native JSON as `raw` (supported: `trivy`, `grype`, `semgrep`, `trufflehog`, `npm-audit`, `kube-bench`, `falco`). With `"fullScan": true`, open findings of the same tool/service/environment that are no longer reported are auto-resolved. Findings are deduplicated by fingerprint; a resolved finding reported again is reopened. Requires `ADMIN` or `SECURITY_LEAD` (pipelines use the webhook below).

**Response:**
```json
{
  "success": true,
  "scanId": "scan-123",
  "received": 5,
  "ingested": 4,
  "updated": 1,
  "reopened": 0,
  "autoResolved": 0,
  "complianceMappings": 12
}
```

#### Get Findings
```http
GET /api/findings?service=api-service&environment=production&severity=CRITICAL&status=OPEN
Authorization: Bearer <token>
```

Also: `tool`, `category`, `search`, `page`, `limit`.

**Response:**
```json
{
  "data": [{ "id": "finding-123", "tool": "trivy", "severity": "CRITICAL", "title": "CVE-2023-1234", "status": "OPEN", "lastSeenAt": "2026-01-15T10:00:00Z" }],
  "pagination": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 }
}
```

#### Change Finding Status
```http
PATCH /api/findings/:id/status
{ "status": "FALSE_POSITIVE", "note": "Not reachable: library only used in tests" }
```
Developers may set `OPEN`, `IN_PROGRESS`, `RESOLVED` on their services; `IGNORED`/`FALSE_POSITIVE` require a security lead and a note.

#### Trend
`GET /api/findings/stats/trend?days=30` returns new vs resolved findings per day.

#### Resolve Finding
```http
POST /api/findings/:id/resolve
Content-Type: application/json
Authorization: Bearer <token>

{
  "note": "Upgraded to 2.0.0"
}
```

#### Get Statistics
```http
GET /api/findings/stats/summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 150,
  "open": 100,
  "resolved": 50,
  "bySeverity": { "CRITICAL": 5, "HIGH": 20 },
  "openBySeverity": { "CRITICAL": 2, "HIGH": 12 },
  "byStatus": { "OPEN": 100, "RESOLVED": 50 },
  "openByService": { "api-service": 40 },
  "byTool": { "trivy": 90 }
}
```

#### Get MTTR
```http
GET /api/findings/stats/mttr
Authorization: Bearer <token>
```

**Response:**
```json
{
  "mttrHours": 24.5,
  "sampleSize": 50,
  "bySeverity": { "CRITICAL": { "mttrHours": 6.2, "sampleSize": 4 } }
}
```

### Compliance

#### Get Compliance Status
```http
GET /api/compliance/status?framework=DPDP_ACT
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalControls": 25,
  "compliantControls": 20,
  "nonCompliantFindings": 15,
  "riskScore": 65,
  "byFramework": {
    "DPDP_ACT": {
      "total": 5,
      "compliant": 4,
      "findings": 5,
      "riskScore": 70
    }
  }
}
```

#### Get Frameworks
```http
GET /api/compliance/frameworks
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "DPDP_ACT",
    "name": "DPDP Act (Digital Personal Data Protection)",
    "description": "Indian data protection law",
    "controls": ["DATA_LOCALIZATION", "CONSENT_MGMT"]
  }
]
```

#### Get Controls
```http
GET /api/compliance/controls?framework=DPDP_ACT
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "DPDP_DATA_LOCALIZATION",
    "title": "Data Localization Requirements",
    "clause": "Section 6: Cross-border data transfer restrictions",
    "description": "Personal data must be stored within India"
  }
]
```

#### Get Compliance Score
```http
GET /api/compliance/score?framework=DPDP_ACT&service=api-service
Authorization: Bearer <token>
```

**Response:**
```json
{
  "score": 85,
  "totalFindings": 20,
  "resolvedFindings": 17,
  "openFindings": 3
}
```

### Approvals

#### Request Deployment
```http
POST /api/approvals/deployments
Content-Type: application/json
Authorization: Bearer <token>

{
  "service": "api-service",
  "environment": "production",
  "version": "v1.2.0",
  "commitSha": "abc123def456"
}
```

**Response:**
```json
{
  "id": "deploy-123",
  "status": "PENDING",
  "findingsCount": 5,
  "criticalCount": 0,
  "highCount": 2,
  "gate": { "eligible": true, "message": "Deployment eligible for approval" }
}
```
The requester is taken from the token. Open CRITICAL findings for the service/environment make the request `REJECTED` with `gateBlocked: true`.

#### Approve Deployment
```http
POST /api/approvals/deployments/:id/approve
Content-Type: application/json
Authorization: Bearer <token>

{
  "comments": "All critical findings resolved"
}
```

#### Reject Deployment
```http
POST /api/approvals/deployments/:id/reject
Content-Type: application/json
Authorization: Bearer <token>

{
  "reason": "Critical findings must be resolved"
}
```
Approve/reject require `ADMIN` or `SECURITY_LEAD`, and the requester cannot decide on their own request.

#### Grant Exception (gate-blocked deployment)
```http
POST /api/approvals/deployments/:id/exception
{ "findingIds": ["<every open critical finding id>"], "justification": "Compensating WAF rule until patch ships" }
```
Moves the deployment back to `PENDING` with the exceptions recorded.

#### Deployed / Rollback
`POST /api/approvals/deployments/:id/deployed` (from `APPROVED`) and `POST /api/approvals/deployments/:id/rollback` (from `DEPLOYED`).

#### Get Deployment Status
```http
GET /api/approvals/deployments/:id/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "deploy-123",
  "status": "APPROVED",
  "approvedBy": "security@example.com",
  "approvedAt": "2024-01-15T12:00:00Z",
  "approvals": [
    {
      "approver": { "name": "Security Lead" },
      "decision": "approved",
      "comments": "Approved"
    }
  ]
}
```

#### Get Pending Deployments
```http
GET /api/approvals/deployments?service=api-service
Authorization: Bearer <token>
```

#### Get Approval History
```http
GET /api/approvals/deployments/:id/history
Authorization: Bearer <token>
```

### Users

#### Register
```http
POST /api/users/register
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:** `{ "user": { "id": "...", "role": "DEVELOPER", ... }, "token": "<jwt>" }`. Roles and owned services are set by an admin (`PATCH /api/users/:id/role`, `POST /api/users/:id/services`).

#### Login
```http
POST /api/users/login
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "email": "developer@example.com",
    "name": "John Doe",
    "role": "DEVELOPER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```

#### Assign Services
```http
POST /api/users/:id/services
Content-Type: application/json
Authorization: Bearer <token>

{
  "services": ["api-service", "new-service"]
}
```

### Reporting

#### Generate Report
```http
POST /api/reporting/generate
Content-Type: application/json
Authorization: Bearer <token>

{
  "framework": "DPDP_ACT",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "generatedBy": "security@example.com"
}
```

**Response:**
```json
{
  "reportId": "report-123",
  "pdfUrl": "/reports/report-123.pdf",
  "complianceScore": 85.5
}
```

#### Download Report
```http
GET /api/reporting/download/:id
Authorization: Bearer <token>
```

#### Get Report History
```http
GET /api/reporting/history?framework=DPDP_ACT
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "report-123",
    "title": "DPDP Act Compliance Report",
    "framework": "DPDP_ACT",
    "generatedAt": "2024-01-15T10:00:00Z",
    "complianceScore": 85.5
  }
]
```

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Invalid input data"
}
```

### Common Error Codes

- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

## Rate Limiting

API is rate-limited to 100 requests per minute per IP address.

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642234567
```

## Pagination

List endpoints support pagination:

```
GET /api/findings?page=1&limit=50
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

## Webhooks

### Ingestion Webhook

CI/CD systems can send scan results via webhook:

```http
POST /api/webhooks/findings
Content-Type: application/json
X-Webhook-Secret: your-webhook-secret

{
  "tool": "trivy",
  "scanId": "scan-123",
  "service": "api-service",
  "environment": "production",
  "findings": [...]
}
```

Authenticate with `X-Webhook-Secret: <WEBHOOK_SECRET>` or `X-Webhook-Signature: sha256=<hex HMAC-SHA256 of the raw body>`. Webhooks are rate limited per source IP (Redis token bucket).

Other webhook endpoints:
- `POST /api/webhooks/deployments` `{ service, environment, version, commitSha, requestedBy }` requests an approval from a pipeline (returns the gate result).
- `GET /api/webhooks/deployments/:id` lets the pipeline poll the decision.
- `POST /api/webhooks/deployments/:id/deployed` reports that an approved release went out.
- `POST /api/webhooks/sbom` `{ image, service?, format: "spdx-json"|"syft-json"|"cyclonedx-json", document }` stores an SBOM.

The Grype, Syft and kube-bench CronJobs (`grype/`, `syft/`, `kube-bench/`) post their output to these endpoints. Configure them with `k8s/scanner-integration.yaml`.

## Scans

`POST /api/scans/grype`, `/api/scans/trivy`, `/api/scans/sbom` run the scanners on the API host (`{ image, service?, environment? }`, `ADMIN`/`SECURITY_LEAD`). With `service`, results are ingested as findings. Grype returns 422 if critical vulnerabilities are found. `GET /api/scans/sboms` and `GET /api/scans/sboms/:id` list and return stored SBOMs.

## Audit and health

- `GET /api/audit?entityType=&entityId=&action=&actor=` returns the audit trail (`ADMIN`, `SECURITY_LEAD`, `AUDITOR`).
- `GET /api/health` reports database and Redis status (public).
