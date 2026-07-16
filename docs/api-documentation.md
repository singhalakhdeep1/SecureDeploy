# SecureDeploy API Documentation

## Base URL

```
http://localhost:3001/api
```

## Authentication

All endpoints require JWT authentication except login and register endpoints.

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

**Response:**
```json
{
  "success": true,
  "ingested": 5,
  "scanId": "scan-123"
}
```

#### Get Findings
```http
GET /api/findings?service=api-service&environment=production&severity=CRITICAL&status=OPEN
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "finding-123",
    "tool": "trivy",
    "severity": "CRITICAL",
    "title": "CVE-2023-1234",
    "status": "OPEN",
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

#### Resolve Finding
```http
POST /api/findings/:id/resolve
Content-Type: application/json
Authorization: Bearer <token>

{
  "resolvedBy": "developer@example.com"
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
  "bySeverity": [
    { "severity": "CRITICAL", "_count": 5 },
    { "severity": "HIGH", "_count": 20 }
  ],
  "byStatus": [
    { "status": "OPEN", "_count": 100 },
    { "status": "RESOLVED", "_count": 50 }
  ]
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
  "sampleSize": 50
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
  "commitSha": "abc123def456",
  "requestedBy": "developer@example.com"
}
```

**Response:**
```json
{
  "id": "deploy-123",
  "status": "PENDING",
  "findingsCount": 5,
  "criticalCount": 0,
  "highCount": 2
}
```

#### Approve Deployment
```http
POST /api/approvals/deployments/:id/approve
Content-Type: application/json
Authorization: Bearer <token>

{
  "approver": "security@example.com",
  "comments": "All critical findings resolved",
  "exceptions": ["high-finding-123"]
}
```

#### Reject Deployment
```http
POST /api/approvals/deployments/:id/reject
Content-Type: application/json
Authorization: Bearer <token>

{
  "approver": "security@example.com",
  "reason": "Critical findings must be resolved"
}
```

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
  "name": "John Doe",
  "role": "DEVELOPER",
  "services": ["api-service", "frontend-service"]
}
```

**Response:**
```json
{
  "id": "user-123",
  "email": "developer@example.com",
  "name": "John Doe",
  "role": "DEVELOPER",
  "services": ["api-service", "frontend-service"]
}
```

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
POST /api/users/profile
Content-Type: application/json
Authorization: Bearer <token>

{
  "userId": "user-123"
}
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

Webhook signature verification using `X-Webhook-Secret` header.
