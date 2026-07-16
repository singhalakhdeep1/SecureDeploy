# SecureDeploy Architecture Documentation

## System Overview

SecureDeploy is a full-stack security compliance platform that ingests security scan results from CI/CD pipelines, maps them to regulatory frameworks, and provides deployment approval workflows with audit trails. The platform consists of a NestJS backend API, Next.js frontend dashboard, PostgreSQL database, and Redis cache.

## Architecture Diagram

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

## Component Details

### Ingestion API

**Purpose:** Receive and normalize security scan results from multiple CI/CD tools.

**Features:**
- Webhook endpoints for Trivy, Semgrep, TruffleHog, npm audit
- Normalization to unified schema
- Deduplication logic
- Redis caching for high-volume ingestion
- Batch processing support

**API Endpoints:**
- `POST /api/findings/ingest` - Ingest scan results
- `GET /api/findings` - Query findings with filters
- `GET /api/findings/:id` - Get finding details
- `POST /api/findings/:id/resolve` - Mark finding as resolved

### Compliance Mapping Engine

**Purpose:** Map security findings to regulatory frameworks and calculate compliance scores.

**Supported Frameworks:**
- **DPDP Act (Digital Personal Data Protection Act)**
  - Data localization requirements
  - Consent management
  - Breach notification
  - Data retention policies
  - Data subject rights

- **RBI Cybersecurity Framework**
  - Access control and identity management
  - Vulnerability management
  - Incident response and monitoring
  - Security awareness training
  - Business continuity planning

**Mapping Logic:**
- Critical/High severity findings map to vulnerability management controls
- Data-related findings map to data protection controls
- Access-related findings map to access control controls
- Risk scoring based on severity and framework impact

### Approval Workflow

**Purpose:** Enforce deployment approval gates based on compliance status.

**Workflow:**
1. Developer requests deployment
2. System checks for critical findings
3. Critical findings auto-reject deployment
4. Security lead reviews and approves/rejects
5. Audit trail maintained
6. Exception handling for special cases

**Approval Rules:**
- Critical findings (CVSS 9.0+) always require security lead approval
- High findings require security lead approval or documented exception
- Medium/low findings can be approved by service owners
- MTTR-based approval thresholds for teams with good track records

### Access Control (RBAC)

**Roles:**
- **Admin**: Full system access, user management
- **Security Lead**: View all findings, approve deployments, manage exceptions
- **Developer**: View own service findings, request deployments
- **Auditor**: Read-only access to all data, generate reports

**Visibility Rules:**
- Developers see only their assigned services
- Security leads see all services
- Auditors have read-only access
- Admins have full access

### Reporting Service

**Purpose:** Generate compliance reports for regulatory audits.

**Report Features:**
- Executive summary
- Findings by severity and framework
- Compliance score calculation
- MTTR trends
- Approval audit trail
- Exception documentation
- PDF export

**Report Types:**
- Framework-specific reports (DPDP Act, RBI)
- Time-window reports (daily, weekly, monthly, quarterly)
- Service-specific reports
- Custom date range reports

## Data Model

### Core Entities

**Finding:**
- Tool source (Trivy, Semgrep, etc.)
- Scan ID and service information
- Severity and status
- CVE ID and CVSS score
- File path and line number
- Remediation guidance
- Compliance mappings

**ComplianceMapping:**
- Framework and control ID
- Control title and clause
- Risk score
- Finding relationship

**Deployment:**
- Service and environment
- Version and commit SHA
- Status (PENDING, APPROVED, REJECTED, DEPLOYED)
- Findings counts
- Approval history

**Approval:**
- Deployment relationship
- Approver information
- Decision and comments
- Timestamp

**User:**
- Email and password (hashed)
- Role and assigned services
- Profile information

## Security Architecture

### Authentication
- JWT-based authentication
- Token refresh mechanism
- Password hashing with bcrypt
- Session management

### Authorization
- Role-based access control (RBAC)
- Service-level permissions
- API endpoint guards
- Audit logging

### Data Security
- Encryption at rest (PostgreSQL)
- Encryption in transit (TLS)
- Secrets management
- Input validation and sanitization

### API Security
- Rate limiting
- Request validation
- CORS configuration
- Security headers

## Performance Considerations

### Database Optimization
- Indexed queries on service, environment, severity, status
- Connection pooling
- Query optimization
- Data retention policies

### Caching Strategy
- Redis for frequently accessed data
- Dashboard metrics caching
- Compliance score caching
- API response caching

### Scalability
- Horizontal scaling of backend instances
- Database read replicas
- CDN for static assets
- Load balancing

## Integration Points

### CI/CD Integration
- Webhook endpoints for scan results
- GitHub Actions integration
- Jenkins integration
- GitLab CI integration

### External Services
- Email notifications (for approvals)
- Slack integration (for alerts)
- S3 storage (for PDF reports)
- Monitoring (Prometheus/Grafana)

## Deployment Architecture

### Development
- Docker Compose for local development
- Hot-reload for backend and frontend
- Local PostgreSQL and Redis
- Mock data seeding

### Production
- Kubernetes deployment
- Managed PostgreSQL (RDS)
- Managed Redis (ElastiCache)
- S3 for PDF storage
- CloudFront for CDN
- Application Load Balancer

## Monitoring and Observability

### Metrics
- API response times
- Finding ingestion rates
- Approval workflow metrics
- Compliance score trends
- User activity

### Logging
- Structured JSON logging
- Audit trail for all actions
- Error tracking
- Performance logging

### Alerting
- Critical finding alerts
- Approval request notifications
- System health alerts
- Performance degradation alerts

## Disaster Recovery

### Backup Strategy
- Database daily backups
- Configuration version control
- S3 backup for PDF reports
- Redis persistence

### Recovery Procedures
- Database restore from backup
- Application redeployment
- Configuration restoration
- Data validation

## Compliance Considerations

### Data Privacy
- GDPR compliance for user data
- Data retention policies
- Right to deletion
- Data export capabilities

### Audit Trail
- All user actions logged
- Approval history maintained
- Finding lifecycle tracking
- Report generation history

### Regulatory Reporting
- DPDP Act compliance reports
- RBI framework reports
- Custom framework support
- Audit-ready documentation
