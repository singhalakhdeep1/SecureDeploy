# SecureDeploy Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- PostgreSQL 16+ (if not using Docker)
- Redis 7+ (if not using Docker)
- Git

## Local Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd securedeploy
```

### 2. Environment Variables

Create `.env` file in root directory:

```env
# Database
DATABASE_URL=postgresql://securedeploy:securedeploy_password@localhost:5432/securedeploy

# Redis
REDIS_URL=redis://localhost:6379

# Backend
JWT_SECRET=your-jwt-secret-key-change-in-production
PORT=3001
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 3. Start Services with Docker Compose

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend API on port 3001
- Frontend dashboard on port 3000

### 4. Initialize Database

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 5. Start Development Servers

**Backend:**
```bash
cd backend
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 6. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Production Deployment

### Option 1: Docker Compose (Simple)

1. Build production images:
```bash
docker-compose -f docker-compose.prod.yml build
```

2. Start production services:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Kubernetes

**Prerequisites:**
- kubectl configured
- Kubernetes cluster (EKS/GKE/AKS)
- Helm installed

**Deploy with Helm:**

```bash
helm install securedeploy ./helm/securedeploy \
  --set database.host=your-rds-endpoint \
  --set redis.host=your-redis-endpoint \
  --set jwt.secret=your-production-secret
```

**Upgrade deployment:**
```bash
helm upgrade securedeploy ./helm/securedeploy
```

**Rollback:**
```bash
helm rollback securedeploy
```

### Option 3: Cloud Services

**AWS Deployment:**

1. **Database:**
   - Create RDS PostgreSQL instance
   - Configure security groups
   - Get connection string

2. **Redis:**
   - Create ElastiCache Redis instance
   - Configure security groups
   - Get endpoint URL

3. **Backend:**
   - Deploy to ECS Fargate
   - Configure environment variables
   - Set up ALB for load balancing

4. **Frontend:**
   - Build static files
   - Deploy to S3
   - Configure CloudFront CDN

5. **Monitoring:**
   - Set up CloudWatch alarms
   - Configure X-Ray tracing
   - Enable AWS WAF

## Database Migrations

### Create Migration

```bash
cd backend
npx prisma migrate dev --name migration_name
```

### Apply Migration to Production

```bash
npx prisma migrate deploy
```

### Rollback Migration

```bash
npx prisma migrate resolve --rolled-back migration_name
```

## Monitoring and Logging

### Application Logs

**Backend logs:**
```bash
docker logs securedeploy-backend -f
```

**Frontend logs:**
```bash
docker logs securedeploy-frontend -f
```

**Database logs:**
```bash
docker logs securedeploy-postgres -f
```

### Health Checks

**Backend health:**
```bash
curl http://localhost:3001/api/health
```

**Database health:**
```bash
docker exec securedeploy-postgres pg_isready -U securedeploy
```

**Redis health:**
```bash
docker exec securedeploy-redis redis-cli ping
```

## Backup and Restore

### Database Backup

```bash
docker exec securedeploy-postgres pg_dump -U securedeploy securedeploy > backup.sql
```

### Database Restore

```bash
docker exec -i securedeploy-postgres psql -U securedeploy securedeploy < backup.sql
```

### S3 Backup (Production)

Configure automated backups in AWS RDS:
- Retention period: 7 days
- Backup window: 03:00-04:00 UTC
- Multi-AZ: Enabled

## Security Configuration

### SSL/TLS

**Development:**
- Self-signed certificates for local HTTPS

**Production:**
- Use ACM for SSL certificates
- Configure ALB with HTTPS listener
- Force HTTPS redirect

### Secrets Management

**Development:**
- Environment variables in `.env` file
- `.env` in `.gitignore`

**Production:**
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets

### Firewall Rules

**Development:**
- Allow local network access
- Database accessible from localhost

**Production:**
- Restrict database access to application IPs
- Enable security groups
- Configure network ACLs

## Performance Tuning

### Database

**Connection Pooling:**
```env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
```

**Query Optimization:**
- Add indexes on frequently queried columns
- Use connection pooling
- Enable query caching

### Redis

**Memory Configuration:**
```env
REDIS_MAX_MEMORY=256mb
REDIS_MAX_MEMORY_POLICY=allkeys-lru
```

### Application

**Node.js:**
```env
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048
```

## Troubleshooting

### Common Issues

**Database connection failed:**
- Check PostgreSQL is running
- Verify connection string
- Check network connectivity

**Redis connection failed:**
- Check Redis is running
- Verify Redis URL
- Check firewall rules

**API returns 401 Unauthorized:**
- Verify JWT token is valid
- Check token expiration
- Verify secret key matches

**Frontend can't connect to backend:**
- Check CORS configuration
- Verify API URL
- Check network connectivity

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "Checking services..."

# Backend
curl -f http://localhost:3001/api/health || echo "Backend health check failed"

# Database
docker exec securedeploy-postgres pg_isready -U securedeploy || echo "Database health check failed"

# Redis
docker exec securedeploy-redis redis-cli ping || echo "Redis health check failed"

echo "Health check complete"
```

## Scaling

### Horizontal Scaling

**Backend:**
```bash
docker-compose up --scale backend=3
```

**Kubernetes Horizontal Pod Autoscaler:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: securedeploy-backend
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: securedeploy-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Database Scaling

**Read Replicas:**
- Configure read replicas in RDS
- Update connection string for read operations
- Implement read/write splitting

## Maintenance

### Database Maintenance

**Weekly:**
- Check disk space
- Review slow queries
- Update statistics

**Monthly:**
- Run VACUUM ANALYZE
- Review and optimize indexes
- Check backup integrity

### Application Updates

**Zero-downtime deployment:**
1. Deploy new version to canary
2. Monitor for issues
3. Gradually shift traffic
4. Rollback if issues detected

### Security Updates

**Monthly:**
- Update dependencies
- Security scan
- Patch vulnerabilities
- Review access logs

## Support

For issues or questions:
- Check documentation
- Review logs
- Check health status
- Contact support team
