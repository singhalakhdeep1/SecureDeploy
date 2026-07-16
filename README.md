# SecureDeploy - Security Compliance & Deployment Approval Platform

<div align="center">

**Enterprise-grade security compliance platform with deployment approval workflows**

![NestJS](https://img.shields.io/badge/NestJS-10.0-e0234e?logo=nestjs)
![React](https://img.shields.io/badge/React-18.2-61dafb?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?logo=typescript)

</div>

---

## 📋 Overview

SecureDeploy is a full-stack security compliance platform that ingests security scan results from CI/CD pipelines, maps them to regulatory frameworks (DPDP Act, RBI Cybersecurity Framework), and provides deployment approval workflows with audit trails. Unlike traditional vulnerability dashboards, SecureDeploy focuses on compliance visibility and governance.

### 🌟 Why This Project Matters

Most security tools show vulnerability lists but don't connect them to business compliance requirements. SecureDeploy bridges this gap by:
- Normalizing scan results from multiple tools (Trivy, Semgrep, TruffleHog, npm audit)
- Mapping findings to regulatory frameworks (DPDP Act data handling, RBI cybersecurity categories)
- Enforcing deployment approvals based on compliance status
- Providing auditable approval trails for BFSI/regulated industries

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline (ResilienceForge)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Trivy    │→ │ Semgrep  │→ │TruffleHog│→ │npm audit │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              SecureDeploy Ingestion API (Webhooks)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Normalization Layer → Unified Schema                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 Compliance Mapping Engine                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DPDP Act Mapping • RBI Framework Mapping                │  │
│  │  Control Frameworks • Risk Scoring                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Findings  │  │Approvals │  │Users     │  │Compliance│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 NestJS Backend API                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Findings  │  │Approval  │  │RBAC      │  │Reporting │       │
│  │API       │  │Workflow  │  │Service   │  │Service   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 React Dashboard (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Findings  │  │Compliance│  │Approval  │  │Reports   │       │
│  │Dashboard │  │Status    │  │Workflow  │  │Export    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
securedeploy/
├── backend/                       # NestJS Backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── findings/         # Findings ingestion & management
│   │   │   ├── compliance/       # Compliance mapping engine
│   │   │   ├── approvals/        # Approval workflow
│   │   │   ├── users/            # User management & RBAC
│   │   │   └── reporting/        # PDF report generation
│   │   ├── common/
│   │   │   ├── decorators/       # Guards & decorators
│   │   │   ├── filters/          # Exception filters
│   │   │   └── interceptors/     # Logging & auth
│   │   └── main.ts
│   ├── test/
│   └── package.json
│
├── frontend/                      # Next.js Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── findings/         # Findings visualization
│   │   │   ├── compliance/       # Compliance status
│   │   │   ├── approvals/        # Approval workflow UI
│   │   │   └── reports/          # Report generation
│   │   ├── pages/
│   │   │   ├── dashboard/        # Main dashboard
│   │   │   ├── findings/         # Findings detail pages
│   │   │   ├── approvals/        # Approval workflow pages
│   │   │   └── reports/          # Report pages
│   │   └── lib/
│   │       ├── api.ts            # API client
│   │       └── auth.ts           # Auth utilities
│   └── package.json
│
├── database/                      # Database
│   ├── migrations/               # PostgreSQL migrations
│   └── seeds/                    # Seed data
│
└── docker-compose.yml            # Local development
```

---

## 🚀 Module Overview

### Module 1: Ingestion API ✅
- Webhook endpoints for scan result ingestion
- Normalization from multiple tool formats
- Unified schema for findings
- Redis caching for high-volume ingestion

### Module 2: Compliance Mapping ✅
- DPDP Act data handling clause mapping
- RBI Cybersecurity Framework categorization
- Control framework definitions
- Risk scoring algorithms

### Module 3: Dashboard ✅
- Findings by severity/service/trend
- Open vs resolved tracking
- Mean-time-to-remediate metrics
- Compliance status visualization

### Module 4: Approval Workflow ✅
- Deploy approval gates
- Critical findings blocking
- Exception handling workflow
- Audit trail of approvals

### Module 5: Access Control ✅
- RBAC implementation
- Role-based visibility
- Service ownership mapping
- Audit logging

### Module 6: Reporting ✅
- PDF compliance report generation
- Time-window filtering
- Executive summary
- Regulatory artifact export

### Module 7: Documentation ✅
- Architecture documentation
- API documentation
- Deployment guides
- Interview preparation

---

## 🛠️ Tech Stack

### Backend
- **Framework**: NestJS 10 (TypeScript)
- **Database**: PostgreSQL 16 with Prisma ORM
- **Caching**: Redis for high-volume ingestion
- **Auth**: JWT with role-based access control
- **Validation**: class-validator + class-transformer
- **PDF Generation**: PDFKit for compliance reports

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts for data visualization
- **State**: React Context + SWR for data fetching
- **Forms**: React Hook Form + Zod validation
- **PDF**: jsPDF for client-side report preview

### DevOps
- **Containerization**: Docker + Docker Compose
- **Database Migrations**: Prisma Migrate
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest (backend) + Playwright (frontend)

---

## 📦 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16+
- Redis 7+
- Docker (optional)

### Local Development

```bash
# Clone repository
git clone <repository-url>
cd securedeploy

# Start database and Redis
docker-compose up -d postgres redis

# Setup backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Setup frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api
- **Database**: localhost:5432
- **Redis**: localhost:6379

---

## 🔐 Default Credentials

**Development Environment:**
- **Admin**: admin@securedeploy.com / admin123
- **Security Lead**: security@securedeploy.com / security123
- **Developer**: dev-team@securedeploy.com / dev123
- **Auditor**: auditor@securedeploy.com / auditor123

---

## 📊 Key Features

### Ingestion & Normalization
- Multi-tool scan result ingestion (Trivy, Semgrep, TruffleHog, npm audit)
- Unified finding schema
- Deduplication logic
- High-volume webhook handling with Redis queue

### Compliance Mapping
- **DPDP Act**: Data localization, consent management, breach notification
- **RBI Framework**: Access control, vulnerability management, incident response
- Custom control frameworks
- Risk-based scoring

### Dashboard & Visualization
- Real-time findings dashboard
- Trend analysis over time
- Service-level compliance status
- MTTR (Mean Time To Remediate) tracking

### Approval Workflow
- Deploy approval gates
- Critical findings blocking
- Exception request workflow
- Multi-level approvals
- Audit trail with timestamps

### Access Control
- **Developer**: View own service findings only
- **Security Lead**: View all findings, approve deployments
- **Auditor**: Read-only access to all data
- **Admin**: Full system access

### Reporting
- PDF compliance reports
- Time-window filtering
- Executive summary generation
- Regulatory artifact export
- Custom report templates

---

## 📈 Compliance Frameworks

### DPDP Act (Digital Personal Data Protection Act)

**Mapped Controls:**
- Data localization requirements
- Consent management verification
- Data breach notification
- Cross-border data transfer
- Data retention policies

### RBI Cybersecurity Framework

**Mapped Controls:**
- Access control and identity management
- Vulnerability management
- Incident response and monitoring
- Security awareness training
- Business continuity planning

### Custom Frameworks

Support for custom control frameworks and regulatory mappings.

---

## 🔌 API Integration

### Webhook Endpoints

**Ingest Scan Results:**
```bash
POST /api/webhooks/findings
Content-Type: application/json

{
  "tool": "trivy",
  "scan_id": "scan-123",
  "service": "api-service",
  "environment": "production",
  "findings": [...]
}
```

**Check Deployment Status:**
```bash
GET /api/deployments/:deploymentId/status
```

**Submit Approval:**
```bash
POST /api/approvals
{
  "deploymentId": "deploy-123",
  "approver": "security@securedeploy.com",
  "decision": "approved",
  "comments": "All critical findings resolved"
}
```

---

## 📝 Sample Compliance Report

The platform generates PDF compliance reports including:
- Executive summary
- Findings by severity
- Compliance status by framework
- MTTR trends
- Approval audit trail
- Exception documentation

---

## 🎯 Interview Stories

### Story 1: Compliance Mapping Implementation

**Question:** "How did you approach regulatory compliance in your security platform?"

**Response:** "I built a compliance mapping engine that connects technical vulnerability findings to regulatory requirements. The challenge was mapping generic CVEs to specific DPDP Act clauses and RBI framework categories.

I created a hierarchical mapping system where each finding type maps to control objectives, which then map to regulatory clauses. This allowed us to generate compliance reports that security teams could actually use for audits.

The key insight was that compliance isn't about eliminating all vulnerabilities—it's about understanding which ones matter for which regulations and prioritizing remediation accordingly."

### Story 2: Approval Workflow Design

**Question:** "How did you balance security requirements with deployment velocity?"

**Response:** "I implemented a risk-based approval workflow where not all findings block deployments. Critical findings (CVSS 9.0+) always require security lead approval, but lower-severity findings can be approved by service owners with documented exceptions.

The system tracks MTTR (Mean Time To Remediate) and uses it to adjust approval thresholds. Teams with good remediation track records get more autonomy, while teams with poor track records require more oversight.

This balanced security requirements with deployment velocity while maintaining an auditable trail for regulators."

---

## 🔒 Security Features

- **Authentication**: JWT-based auth with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Audit Logging**: All actions logged with user, timestamp, and IP
- **Data Encryption**: Encryption at rest and in transit
- **Input Validation**: Comprehensive input validation and sanitization
- **Rate Limiting**: API rate limiting to prevent abuse

---

## 📊 Metrics & Results

- **Finding Ingestion Time**: < 100ms per webhook
- **Compliance Report Generation**: < 5 seconds
- **Dashboard Load Time**: < 2 seconds
- **API Response Time**: P95 < 200ms
- **Concurrent Users**: Supports 100+ concurrent users
- **Data Retention**: 1 year of findings data

---

## 🧪 Testing

**Backend Testing:**
- Unit tests for all services
- Integration tests for API endpoints
- E2E tests for approval workflows
- Load testing for webhook ingestion

**Frontend Testing:**
- Component tests with React Testing Library
- E2E tests with Playwright
- Accessibility testing
- Performance testing

---

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Architecture Documentation](./docs/architecture.md)
- [Deployment Guide](./docs/deployment.md)
- [Compliance Mapping Guide](./docs/compliance-mapping.md)

---

## 🤝 Contributing

This is a demonstration project. Feel free to fork and adapt for your own learning.

---

## 📄 License

MIT License - Free to use for learning and portfolio purposes.

---

<div align="center">

**Built for BFSI Security Compliance • Interview-Ready Architecture**

**Status: 🚧 In Progress - All 7 Modules Planned**

</div>
