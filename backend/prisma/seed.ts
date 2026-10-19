/**
 * Demo seed: one user per role and a handful of findings for the "payments-api" service.
 * Passwords come from SEED_PASSWORD (default ChangeMe123!). Safe to re-run.
 *   npm run prisma:seed
 */
import { PrismaClient, type FindingSeverity, type Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { controlById, mapFinding, RISK_BY_SEVERITY } from '../src/modules/compliance/catalog';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash(process.env.SEED_PASSWORD || 'ChangeMe123!', 12);
  const users: { email: string; name: string; role: Role; services: string[] }[] = [
    { email: 'admin@securedeploy.local', name: 'Admin', role: 'ADMIN', services: [] },
    { email: 'lead@securedeploy.local', name: 'Security Lead', role: 'SECURITY_LEAD', services: [] },
    { email: 'dev@securedeploy.local', name: 'Developer', role: 'DEVELOPER', services: ['payments-api'] },
    { email: 'auditor@securedeploy.local', name: 'Auditor', role: 'AUDITOR', services: [] },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, password } });
  }

  const samples: { tool: string; category: string; severity: FindingSeverity; title: string; description: string; cveId?: string; packageName?: string; filePath?: string }[] = [
    { tool: 'trivy', category: 'vulnerability', severity: 'CRITICAL', title: 'CVE-2024-21626 in runc', description: 'Container breakout via leaked file descriptor', cveId: 'CVE-2024-21626', packageName: 'runc' },
    { tool: 'npm-audit', category: 'vulnerability', severity: 'HIGH', title: 'express: open redirect', description: 'Open redirect in express < 4.19.2', cveId: 'GHSA-rv95-896h-c2vc', packageName: 'express' },
    { tool: 'semgrep', category: 'code', severity: 'HIGH', title: 'javascript.express.security.audit.sqli', description: 'Possible SQL injection: user input concatenated into query', filePath: 'src/payments/repository.ts' },
    { tool: 'trufflehog', category: 'secret', severity: 'CRITICAL', title: 'AWS secret (verified)', description: 'Verified live AWS credential committed', filePath: 'config/legacy.env' },
    { tool: 'kube-bench', category: 'misconfiguration', severity: 'MEDIUM', title: 'CIS 5.2.5: Minimize admission of containers with allowPrivilegeEscalation', description: 'Pod security policy allows privilege escalation', cveId: 'CIS-5.2.5' },
  ];
  for (const s of samples) {
    const fp = createHash('sha256').update(`seed|${s.tool}|${s.title}`).digest('hex');
    const finding = await prisma.finding.upsert({
      where: { fingerprint: fp },
      update: {},
      create: { ...s, fingerprint: fp, scanId: 'seed', service: 'payments-api', environment: 'production' },
    });
    const data = mapFinding(finding).map((controlId) => {
      const c = controlById.get(controlId)!;
      return { findingId: finding.id, framework: c.framework, controlId, controlTitle: c.title, clause: c.clause, riskScore: RISK_BY_SEVERITY[finding.severity] };
    });
    await prisma.complianceMapping.createMany({ data, skipDuplicates: true });
  }
  console.log(`Seeded ${users.length} users and ${samples.length} findings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
