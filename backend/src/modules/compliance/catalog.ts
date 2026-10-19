/**
 * Compliance control catalog and the rule engine that maps findings onto controls.
 * A control is compliant when none of its mapped findings is still open.
 */
import type { ComplianceFramework, FindingSeverity } from '@prisma/client';

export interface Control {
  id: string;
  framework: ComplianceFramework;
  title: string;
  clause: string;
  description: string;
}

export const FRAMEWORKS: { id: ComplianceFramework; name: string; description: string }[] = [
  { id: 'DPDP_ACT', name: 'DPDP Act (Digital Personal Data Protection Act, 2023)', description: 'Indian data protection law' },
  { id: 'RBI_CYBERSECURITY', name: 'RBI Cybersecurity Framework', description: 'Reserve Bank of India cybersecurity guidelines for banks and regulated entities' },
  { id: 'ISO_27001', name: 'ISO/IEC 27001:2022', description: 'Information security management (Annex A controls)' },
  { id: 'SOC_2', name: 'SOC 2 (Trust Services Criteria)', description: 'Service organization controls (common criteria)' },
];

export const CONTROLS: Control[] = [
  // DPDP Act
  { id: 'DPDP_SECURITY_SAFEGUARDS', framework: 'DPDP_ACT', title: 'Reasonable Security Safeguards', clause: 'Section 8(5): Reasonable security safeguards to prevent personal data breach', description: 'Protect personal data with appropriate technical and organisational measures' },
  { id: 'DPDP_BREACH_NOTIFY', framework: 'DPDP_ACT', title: 'Data Breach Notification', clause: 'Section 8(6): Intimation of personal data breach', description: 'Notify the Board and affected principals of a breach' },
  { id: 'DPDP_DATA_RETENTION', framework: 'DPDP_ACT', title: 'Data Retention Limits', clause: 'Section 8(7): Erasure when purpose is served', description: 'Retain personal data only as long as necessary' },
  { id: 'DPDP_CONSENT_MGMT', framework: 'DPDP_ACT', title: 'Consent Management', clause: 'Section 6: Consent', description: 'Clear, informed consent required for processing' },
  { id: 'DPDP_ACCESS_RIGHTS', framework: 'DPDP_ACT', title: 'Data Principal Rights', clause: 'Sections 11-14: Rights of the data principal', description: 'Access, correction, erasure and grievance redressal' },
  // RBI
  { id: 'RBI_ACCESS_CONTROL', framework: 'RBI_CYBERSECURITY', title: 'Access Control and Identity Management', clause: 'Annex 1, 8: User access control / management', description: 'Strong authentication, least privilege, credential protection' },
  { id: 'RBI_VULN_MGMT', framework: 'RBI_CYBERSECURITY', title: 'Vulnerability Management', clause: 'Annex 1, 7: Patch / vulnerability and change management', description: 'Regular vulnerability scanning and timely remediation' },
  { id: 'RBI_SECURE_CONFIG', framework: 'RBI_CYBERSECURITY', title: 'Secure Configuration', clause: 'Annex 1, 4: Secure configuration', description: 'Hardened baselines for systems and platforms' },
  { id: 'RBI_APP_SECURITY', framework: 'RBI_CYBERSECURITY', title: 'Application Security Life Cycle', clause: 'Annex 1, 6: Application security life cycle (ASLC)', description: 'Secure coding and security testing in the SDLC' },
  { id: 'RBI_INCIDENT_RESPONSE', framework: 'RBI_CYBERSECURITY', title: 'Incident Response and Monitoring', clause: 'Annex 1, 15/19: SOC and incident response', description: 'Detect, respond to and report incidents' },
  // ISO 27001:2022 Annex A
  { id: 'ISO_A_5_15', framework: 'ISO_27001', title: 'Access control', clause: 'A.5.15', description: 'Rules to control physical and logical access' },
  { id: 'ISO_A_5_17', framework: 'ISO_27001', title: 'Authentication information', clause: 'A.5.17', description: 'Allocation and management of secrets and credentials' },
  { id: 'ISO_A_8_8', framework: 'ISO_27001', title: 'Management of technical vulnerabilities', clause: 'A.8.8', description: 'Identify, evaluate and remediate technical vulnerabilities' },
  { id: 'ISO_A_8_9', framework: 'ISO_27001', title: 'Configuration management', clause: 'A.8.9', description: 'Secure configurations established and monitored' },
  { id: 'ISO_A_8_16', framework: 'ISO_27001', title: 'Monitoring activities', clause: 'A.8.16', description: 'Networks and systems monitored for anomalous behaviour' },
  { id: 'ISO_A_8_28', framework: 'ISO_27001', title: 'Secure coding', clause: 'A.8.28', description: 'Secure coding principles applied to software development' },
  // SOC 2
  { id: 'SOC2_CC6_1', framework: 'SOC_2', title: 'Logical access security', clause: 'CC6.1', description: 'Logical access security software, infrastructure and architectures' },
  { id: 'SOC2_CC7_1', framework: 'SOC_2', title: 'Vulnerability detection', clause: 'CC7.1', description: 'Detection and monitoring procedures identify new vulnerabilities and configuration changes' },
  { id: 'SOC2_CC7_2', framework: 'SOC_2', title: 'Anomaly monitoring', clause: 'CC7.2', description: 'System components monitored for anomalies indicative of malicious acts' },
  { id: 'SOC2_CC8_1', framework: 'SOC_2', title: 'Change management', clause: 'CC8.1', description: 'Changes are authorised, designed, tested and approved' },
];

export const controlsFor = (framework: ComplianceFramework) => CONTROLS.filter((c) => c.framework === framework);
export const controlById = new Map(CONTROLS.map((c) => [c.id, c]));

export const RISK_BY_SEVERITY: Record<FindingSeverity, number> = { CRITICAL: 90, HIGH: 70, MEDIUM: 50, LOW: 30, INFO: 10 };

export interface MappableFinding {
  tool: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  description: string;
}

const PII = /\b(pii|personal data|personal information|aadhaar|pan card|email address|phone number|date of birth|ssn)\b/i;
const INJECTION = /\b(sql injection|sqli|xss|cross-site|command injection|rce|remote code|deserializ|path traversal|ssrf)\b/i;
const AUTH = /\b(auth|password|session|jwt|token|credential|privilege|rbac|access control)\b/i;

/** Rule engine: which controls a finding violates. INFO findings are tracked but not mapped. */
export function mapFinding(f: MappableFinding): string[] {
  if (f.severity === 'INFO') return [];
  const text = `${f.title} ${f.description}`;
  const ids = new Set<string>();
  switch (f.category) {
    case 'secret':
      ['RBI_ACCESS_CONTROL', 'ISO_A_5_17', 'SOC2_CC6_1', 'DPDP_SECURITY_SAFEGUARDS'].forEach((id) => ids.add(id));
      break;
    case 'code':
      ['RBI_APP_SECURITY', 'ISO_A_8_28', 'SOC2_CC8_1'].forEach((id) => ids.add(id));
      if (INJECTION.test(text)) ids.add('DPDP_SECURITY_SAFEGUARDS');
      if (AUTH.test(text)) ['RBI_ACCESS_CONTROL', 'ISO_A_5_15', 'SOC2_CC6_1'].forEach((id) => ids.add(id));
      break;
    case 'misconfiguration':
      ['RBI_SECURE_CONFIG', 'ISO_A_8_9', 'SOC2_CC7_1'].forEach((id) => ids.add(id));
      if (AUTH.test(text)) ['RBI_ACCESS_CONTROL', 'ISO_A_5_15'].forEach((id) => ids.add(id));
      break;
    case 'runtime':
      ['RBI_INCIDENT_RESPONSE', 'ISO_A_8_16', 'SOC2_CC7_2', 'DPDP_BREACH_NOTIFY'].forEach((id) => ids.add(id));
      break;
    default: // vulnerability
      ['RBI_VULN_MGMT', 'ISO_A_8_8', 'SOC2_CC7_1'].forEach((id) => ids.add(id));
      if (f.severity === 'CRITICAL' || f.severity === 'HIGH') ids.add('DPDP_SECURITY_SAFEGUARDS');
  }
  if (PII.test(text)) ['DPDP_SECURITY_SAFEGUARDS', 'DPDP_DATA_RETENTION'].forEach((id) => ids.add(id));
  return [...ids];
}
