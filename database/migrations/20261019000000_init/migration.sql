-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECURITY_LEAD', 'DEVELOPER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "ComplianceFramework" AS ENUM ('DPDP_ACT', 'RBI_CYBERSECURITY', 'ISO_27001', 'SOC_2', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DEPLOYED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DEVELOPER',
    "services" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'vulnerability',
    "scanId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "filePath" TEXT,
    "lineNumber" INTEGER,
    "cveId" TEXT,
    "cvssScore" DOUBLE PRECISION,
    "packageName" TEXT,
    "installedVersion" TEXT,
    "fixedVersion" TEXT,
    "remediation" TEXT,
    "statusNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_mappings" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "framework" "ComplianceFramework" NOT NULL,
    "controlId" TEXT NOT NULL,
    "controlTitle" TEXT NOT NULL,
    "clause" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "gateBlocked" BOOLEAN NOT NULL DEFAULT false,
    "deployedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "exceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exceptionReason" TEXT,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "framework" "ComplianceFramework" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "findingsCount" INTEGER NOT NULL,
    "resolvedCount" INTEGER NOT NULL,
    "criticalCount" INTEGER NOT NULL,
    "highCount" INTEGER NOT NULL,
    "complianceScore" DOUBLE PRECISION NOT NULL,
    "pdfUrl" TEXT,
    "pdf" BYTEA,

    CONSTRAINT "compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sboms" (
    "id" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "service" TEXT,
    "format" TEXT NOT NULL,
    "componentCount" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sboms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "correlationId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "findings_fingerprint_key" ON "findings"("fingerprint");

-- CreateIndex
CREATE INDEX "findings_service_environment_idx" ON "findings"("service", "environment");

-- CreateIndex
CREATE INDEX "findings_severity_status_idx" ON "findings"("severity", "status");

-- CreateIndex
CREATE INDEX "findings_tool_service_environment_idx" ON "findings"("tool", "service", "environment");

-- CreateIndex
CREATE INDEX "compliance_mappings_framework_controlId_idx" ON "compliance_mappings"("framework", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_mappings_findingId_framework_controlId_key" ON "compliance_mappings"("findingId", "framework", "controlId");

-- CreateIndex
CREATE INDEX "deployments_service_environment_idx" ON "deployments"("service", "environment");

-- CreateIndex
CREATE INDEX "deployments_status_idx" ON "deployments"("status");

-- CreateIndex
CREATE INDEX "approvals_deploymentId_idx" ON "approvals"("deploymentId");

-- CreateIndex
CREATE INDEX "approvals_approverId_idx" ON "approvals"("approverId");

-- CreateIndex
CREATE INDEX "compliance_reports_framework_startDate_idx" ON "compliance_reports"("framework", "startDate");

-- CreateIndex
CREATE INDEX "sboms_image_idx" ON "sboms"("image");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "compliance_mappings" ADD CONSTRAINT "compliance_mappings_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

