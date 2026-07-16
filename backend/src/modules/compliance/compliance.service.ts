import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  // DPDP Act Compliance Framework
  private readonly dpdpControls = {
    DATA_LOCALIZATION: {
      id: 'DPDP_DATA_LOCALIZATION',
      title: 'Data Localization Requirements',
      clause: 'Section 6: Cross-border data transfer restrictions',
      description: 'Personal data must be stored within India unless exceptions apply',
    },
    CONSENT_MANAGEMENT: {
      id: 'DPDP_CONSENT_MGMT',
      title: 'Consent Management',
      clause: 'Section 7: Consent requirements',
      description: 'Clear, informed consent required for data processing',
    },
    BREACH_NOTIFICATION: {
      id: 'DPDP_BREACH_NOTIFY',
      title: 'Data Breach Notification',
      clause: 'Section 10: Breach notification timeline',
      description: 'Notify authorities within 72 hours of breach discovery',
    },
    DATA_RETENTION: {
      id: 'DPDP_DATA_RETENTION',
      title: 'Data Retention Policies',
      clause: 'Section 9: Data retention limits',
      description: 'Data must be retained only for necessary purposes',
    },
    ACCESS_RIGHTS: {
      id: 'DPDP_ACCESS_RIGHTS',
      title: 'Data Subject Rights',
      clause: 'Section 8: Right to access and correction',
      description: 'Users must be able to access and correct their data',
    },
  };

  // RBI Cybersecurity Framework
  private readonly rbiControls = {
    ACCESS_CONTROL: {
      id: 'RBI_ACCESS_CONTROL',
      title: 'Access Control and Identity Management',
      clause: 'Section 4.1: Access control',
      description: 'Implement strong access controls and identity management',
    },
    VULNERABILITY_MGMT: {
      id: 'RBI_VULN_MGMT',
      title: 'Vulnerability Management',
      clause: 'Section 4.2: Vulnerability management',
      description: 'Regular vulnerability scanning and remediation',
    },
    INCIDENT_RESPONSE: {
      id: 'RBI_INCIDENT_RESPONSE',
      title: 'Incident Response and Monitoring',
      clause: 'Section 4.3: Incident response',
      description: 'Establish incident response procedures',
    },
    SECURITY_AWARENESS: {
      id: 'RBI_SECURITY_AWARENESS',
      title: 'Security Awareness Training',
      clause: 'Section 4.4: Security training',
      description: 'Regular security awareness training for staff',
    },
    BUSINESS_CONTINUITY: {
      id: 'RBI_BUSINESS_CONTINUITY',
      title: 'Business Continuity Planning',
      clause: 'Section 4.5: Business continuity',
      description: 'Business continuity and disaster recovery planning',
    },
  };

  async getComplianceStatus(framework?: string) {
    const where = framework ? { framework: framework as any } : {};
    
    const mappings = await this.prisma.complianceMapping.findMany({
      where,
      include: {
        finding: true,
      },
    });

    const status = {
      totalControls: 0,
      compliantControls: 0,
      nonCompliantFindings: 0,
      riskScore: 0,
      byFramework: {},
    };

    // Group by framework
    mappings.forEach((mapping) => {
      if (!status.byFramework[mapping.framework]) {
        status.byFramework[mapping.framework] = {
          total: 0,
          compliant: 0,
          findings: 0,
          riskScore: 0,
        };
      }

      status.byFramework[mapping.framework].total++;
      status.byFramework[mapping.framework].findings++;
      status.byFramework[mapping.framework].riskScore += mapping.riskScore;

      if (mapping.finding.status === 'RESOLVED') {
        status.byFramework[mapping.framework].compliant++;
      } else {
        status.nonCompliantFindings++;
      }
    });

    // Calculate overall stats
    Object.values(status.byFramework).forEach((framework: any) => {
      status.totalControls += framework.total;
      status.compliantControls += framework.compliant;
      status.riskScore += framework.riskScore;
    });

    status.riskScore = status.totalControls > 0 ? status.riskScore / status.totalControls : 0;

    return status;
  }

  getFrameworks() {
    return [
      {
        id: 'DPDP_ACT',
        name: 'DPDP Act (Digital Personal Data Protection)',
        description: 'Indian data protection law',
        controls: Object.keys(this.dpdpControls),
      },
      {
        id: 'RBI_CYBERSECURITY',
        name: 'RBI Cybersecurity Framework',
        description: 'Reserve Bank of India cybersecurity guidelines',
        controls: Object.keys(this.rbiControls),
      },
      {
        id: 'ISO_27001',
        name: 'ISO 27001',
        description: 'Information security management',
        controls: [],
      },
      {
        id: 'SOC_2',
        name: 'SOC 2',
        description: 'Service organization controls',
        controls: [],
      },
    ];
  }

  getControls(framework: string) {
    switch (framework.toUpperCase()) {
      case 'DPDP_ACT':
        return Object.values(this.dpdpControls);
      case 'RBI_CYBERSECURITY':
        return Object.values(this.rbiControls);
      default:
        return [];
    }
  }

  async getFindingMapping(findingId: string) {
    return this.prisma.complianceMapping.findMany({
      where: { findingId },
      include: {
        finding: true,
      },
    });
  }

  async calculateScore(framework: string, service?: string) {
    const where: any = { framework: framework as any };
    if (service) {
      where.finding = { service };
    }

    const mappings = await this.prisma.complianceMapping.findMany({
      where,
      include: {
        finding: true,
      },
    });

    if (mappings.length === 0) {
      return { score: 100, totalFindings: 0, resolvedFindings: 0 };
    }

    const resolvedCount = mappings.filter(
      (m) => m.finding.status === 'RESOLVED'
    ).length;

    const score = (resolvedCount / mappings.length) * 100;

    return {
      score: Math.round(score),
      totalFindings: mappings.length,
      resolvedFindings: resolvedCount,
      openFindings: mappings.length - resolvedCount,
    };
  }

  async mapFindingToCompliance(findingId: string, framework: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
    });

    if (!finding) {
      throw new Error('Finding not found');
    }

    const controls = this.getControls(framework);
    const mappings = [];

    // Map based on finding type and severity
    if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') {
      // Map to vulnerability management controls
      const vulnControl = controls.find((c: any) =>
        c.id.includes('VULN') || c.id.includes('SECURITY')
      );
      if (vulnControl) {
        mappings.push({
          findingId,
          framework,
          controlId: vulnControl.id,
          controlTitle: vulnControl.title,
          clause: vulnControl.clause,
          riskScore: finding.severity === 'CRITICAL' ? 90 : 70,
        });
      }
    }

    // Create mappings
    for (const mapping of mappings) {
      await this.prisma.complianceMapping.create({
        data: mapping,
      });
    }

    return mappings;
  }
}
