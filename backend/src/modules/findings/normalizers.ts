/**
 * Normalization layer: converts native scanner output into the unified finding schema.
 * Supported raw formats: trivy, grype, semgrep, trufflehog, npm-audit, kube-bench, falco.
 * Pre-normalized findings (the `findings` array) are accepted for any tool.
 */
import { createHash } from 'node:crypto';
import type { FindingSeverity } from '@prisma/client';

export interface NormalizedFinding {
  category: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  cveId?: string;
  cvssScore?: number;
  packageName?: string;
  installedVersion?: string;
  fixedVersion?: string;
  remediation?: string;
}

export interface GenericFindingInput {
  severity?: string;
  title?: string;
  description?: string;
  message?: string;
  category?: string;
  filePath?: string;
  path?: string;
  lineNumber?: number;
  line?: number;
  cveId?: string;
  id?: string;
  cvssScore?: number;
  score?: number;
  packageName?: string;
  installedVersion?: string;
  fixedVersion?: string;
  remediation?: string;
  fix?: string;
}

export function normalizeSeverity(severity: unknown): FindingSeverity {
  const map: Record<string, FindingSeverity> = {
    critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', moderate: 'MEDIUM', low: 'LOW', info: 'INFO', informational: 'INFO',
    negligible: 'INFO', unknown: 'MEDIUM', error: 'HIGH', warning: 'MEDIUM', note: 'LOW', emergency: 'CRITICAL', alert: 'CRITICAL', notice: 'LOW',
  };
  return map[String(severity ?? '').toLowerCase()] ?? 'MEDIUM';
}

const TOOL_CATEGORY: Record<string, string> = {
  trivy: 'vulnerability', grype: 'vulnerability', 'npm-audit': 'vulnerability', snyk: 'vulnerability', 'owasp-dependency-check': 'vulnerability',
  semgrep: 'code', codeql: 'code', sonarqube: 'code', bandit: 'code',
  trufflehog: 'secret', gitleaks: 'secret',
  'kube-bench': 'misconfiguration', checkov: 'misconfiguration', kubescape: 'misconfiguration', tfsec: 'misconfiguration', opa: 'misconfiguration',
  falco: 'runtime',
};

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function generic(tool: string, f: GenericFindingInput): NormalizedFinding {
  const description = f.description || f.message || f.title || 'No description';
  return {
    category: f.category || TOOL_CATEGORY[tool] || 'vulnerability',
    severity: normalizeSeverity(f.severity),
    title: clip(f.title || description, 300),
    description: clip(description, 5000),
    filePath: f.filePath || f.path,
    lineNumber: num(f.lineNumber ?? f.line),
    cveId: f.cveId || f.id,
    cvssScore: num(f.cvssScore ?? f.score),
    packageName: f.packageName,
    installedVersion: f.installedVersion,
    fixedVersion: f.fixedVersion,
    remediation: f.remediation || f.fix,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const parsers: Record<string, (raw: any) => NormalizedFinding[]> = {
  trivy: (raw) =>
    (raw?.Results ?? []).flatMap((r: any) => [
      ...(r.Vulnerabilities ?? []).map((v: any): NormalizedFinding => ({
        category: 'vulnerability',
        severity: normalizeSeverity(v.Severity),
        title: clip(`${v.VulnerabilityID} in ${v.PkgName}${v.Title ? `: ${v.Title}` : ''}`, 300),
        description: clip(v.Description || v.Title || v.VulnerabilityID, 5000),
        filePath: r.Target,
        cveId: v.VulnerabilityID,
        cvssScore: num(v.CVSS?.nvd?.V3Score ?? v.CVSS?.redhat?.V3Score),
        packageName: v.PkgName,
        installedVersion: v.InstalledVersion,
        fixedVersion: v.FixedVersion,
        remediation: v.FixedVersion ? `Upgrade ${v.PkgName} to ${v.FixedVersion}` : undefined,
      })),
      ...(r.Misconfigurations ?? []).filter((m: any) => m.Status !== 'PASS').map((m: any): NormalizedFinding => ({
        category: 'misconfiguration',
        severity: normalizeSeverity(m.Severity),
        title: clip(`${m.ID}: ${m.Title}`, 300),
        description: clip(m.Description || m.Message || m.Title, 5000),
        filePath: r.Target,
        lineNumber: num(m.CauseMetadata?.StartLine),
        remediation: m.Resolution,
      })),
      ...(r.Secrets ?? []).map((s: any): NormalizedFinding => ({
        category: 'secret',
        severity: normalizeSeverity(s.Severity),
        title: clip(`${s.RuleID}: ${s.Title}`, 300),
        description: `Secret detected (${s.Category ?? s.RuleID})`,
        filePath: r.Target,
        lineNumber: num(s.StartLine),
        remediation: 'Revoke and rotate the credential, then remove it from the repository history',
      })),
    ]),

  grype: (raw) =>
    (raw?.matches ?? []).map((m: any): NormalizedFinding => {
      const v = m.vulnerability ?? {};
      const fixed = v.fix?.versions?.[0];
      return {
        category: 'vulnerability',
        severity: normalizeSeverity(v.severity),
        title: clip(`${v.id} in ${m.artifact?.name}@${m.artifact?.version}`, 300),
        description: clip(v.description || v.id, 5000),
        filePath: m.artifact?.locations?.[0]?.path,
        cveId: v.id,
        cvssScore: num(v.cvss?.[0]?.metrics?.baseScore),
        packageName: m.artifact?.name,
        installedVersion: m.artifact?.version,
        fixedVersion: fixed,
        remediation: fixed ? `Upgrade ${m.artifact?.name} to ${fixed}` : v.fix?.state,
      };
    }),

  semgrep: (raw) =>
    (raw?.results ?? []).map((r: any): NormalizedFinding => ({
      category: 'code',
      severity: normalizeSeverity(r.extra?.severity),
      title: clip(r.check_id, 300),
      description: clip(r.extra?.message, 5000),
      filePath: r.path,
      lineNumber: num(r.start?.line),
      cveId: Array.isArray(r.extra?.metadata?.cwe) ? String(r.extra.metadata.cwe[0]).split(':')[0] : undefined,
      remediation: r.extra?.fix,
    })),

  trufflehog: (raw) =>
    (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map((r: any): NormalizedFinding => {
      const src = r.SourceMetadata?.Data ?? {};
      const loc = src.Filesystem ?? src.Git ?? src.Github ?? {};
      return {
        category: 'secret',
        severity: r.Verified ? 'CRITICAL' : 'HIGH',
        title: clip(`${r.DetectorName} secret${r.Verified ? ' (verified)' : ''}`, 300),
        description: `${r.Verified ? 'Verified live' : 'Unverified'} ${r.DetectorName} credential found${loc.commit ? ` in commit ${loc.commit}` : ''}`,
        filePath: loc.file,
        lineNumber: num(loc.line),
        remediation: 'Revoke and rotate the credential, then purge it from history',
      };
    }),

  'npm-audit': (raw) =>
    Object.entries(raw?.vulnerabilities ?? {}).flatMap(([name, v]: [string, any]) => {
      const advisories = (v.via ?? []).filter((x: any) => typeof x === 'object');
      if (advisories.length === 0) return []; // transitive-only entries are reported through the root package
      return advisories.map((a: any): NormalizedFinding => ({
        category: 'vulnerability',
        severity: normalizeSeverity(a.severity ?? v.severity),
        title: clip(`${name}: ${a.title}`, 300),
        description: clip(`${a.title} (${a.url ?? 'no advisory url'}), affected range ${a.range ?? v.range}`, 5000),
        filePath: 'package-lock.json',
        cveId: a.url?.split('/').pop() ?? String(a.source),
        cvssScore: num(a.cvss?.score),
        packageName: name,
        installedVersion: v.range,
        remediation: v.fixAvailable === true ? 'Run npm audit fix' : typeof v.fixAvailable === 'object' ? `Upgrade ${v.fixAvailable.name} to ${v.fixAvailable.version}` : 'No fix available',
      }));
    }),

  'kube-bench': (raw) =>
    (raw?.Controls ?? []).flatMap((c: any) =>
      (c.tests ?? []).flatMap((t: any) =>
        (t.results ?? [])
          .filter((r: any) => r.status === 'FAIL' || r.status === 'WARN')
          .map((r: any): NormalizedFinding => ({
            category: 'misconfiguration',
            severity: r.status === 'FAIL' ? (r.scored ? 'HIGH' : 'MEDIUM') : 'LOW',
            title: clip(`CIS ${r.test_number}: ${r.test_desc}`, 300),
            description: clip(`${c.text ?? 'CIS benchmark'} / ${t.desc ?? ''}: ${r.test_desc}`, 5000),
            cveId: `CIS-${r.test_number}`,
            remediation: r.remediation,
          })),
      ),
    ),

  falco: (raw) =>
    (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map((e: any): NormalizedFinding => ({
      category: 'runtime',
      severity: normalizeSeverity(e.priority),
      title: clip(e.rule, 300),
      description: clip(e.output, 5000),
      filePath: e.output_fields?.['container.image.repository'],
      remediation: 'Investigate the workload; isolate the pod if the activity is not expected',
    })),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export const SUPPORTED_RAW_TOOLS = Object.keys(parsers);

export function normalize(tool: string, input: { raw?: unknown; findings?: GenericFindingInput[] }): NormalizedFinding[] {
  const key = tool.toLowerCase();
  const out: NormalizedFinding[] = [];
  if (input.raw !== undefined) {
    const parser = parsers[key];
    if (!parser) throw new Error(`No raw parser for tool "${tool}". Supported: ${SUPPORTED_RAW_TOOLS.join(', ')}`);
    out.push(...parser(input.raw));
  }
  if (input.findings) out.push(...input.findings.map((f) => generic(key, f)));
  return out;
}

export function fingerprint(tool: string, service: string, environment: string, f: NormalizedFinding): string {
  const identity = [tool.toLowerCase(), service, environment, f.category, f.cveId ?? '', f.packageName ?? '', f.installedVersion ?? '', f.filePath ?? '', f.lineNumber ?? '', f.cveId ? '' : f.title];
  return createHash('sha256').update(identity.join('|')).digest('hex');
}
