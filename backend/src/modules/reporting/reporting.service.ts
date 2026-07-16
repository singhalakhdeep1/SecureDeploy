import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportingService {
  constructor(private prisma: PrismaService) {}

  async generateReport(reportDto: any) {
    const { framework, startDate, endDate, generatedBy } = reportDto;

    // Get compliance data for the period
    const findings = await this.prisma.finding.findMany({
      where: {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        complianceMappings: {
          some: { framework: framework as any },
        },
      },
      include: {
        complianceMappings: true,
      },
    });

    const resolvedCount = findings.filter((f) => f.status === 'RESOLVED').length;
    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = findings.filter((f) => f.severity === 'HIGH').length;

    const complianceScore = findings.length > 0 
      ? (resolvedCount / findings.length) * 100 
      : 100;

    // Create report record
    const report = await this.prisma.complianceReport.create({
      data: {
        title: `${framework} Compliance Report`,
        framework: framework as any,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        generatedBy,
        findingsCount: findings.length,
        resolvedCount,
        criticalCount,
        highCount,
        complianceScore,
      },
    });

    // Generate PDF
    const pdfBuffer = await this.generatePDF(report, findings);

    // Store PDF URL (in production, upload to S3)
    const pdfUrl = `/reports/${report.id}.pdf`;

    await this.prisma.complianceReport.update({
      where: { id: report.id },
      data: { pdfUrl },
    });

    return {
      reportId: report.id,
      pdfUrl,
      complianceScore,
    };
  }

  private async generatePDF(report: any, findings: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add content to PDF
      doc.fontSize(20).text(report.title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Framework: ${report.framework}`);
      doc.text(`Period: ${report.startDate.toISOString().split('T')[0]} to ${report.endDate.toISOString().split('T')[0]}`);
      doc.text(`Generated: ${report.generatedAt.toISOString()}`);
      doc.moveDown();

      doc.fontSize(16).text('Executive Summary');
      doc.fontSize(12).text(`Total Findings: ${report.findingsCount}`);
      doc.text(`Resolved: ${report.resolvedCount}`);
      doc.text(`Critical: ${report.criticalCount}`);
      doc.text(`High: ${report.highCount}`);
      doc.text(`Compliance Score: ${report.complianceScore.toFixed(1)}%`);
      doc.moveDown();

      doc.fontSize(16).text('Findings Details');
      findings.forEach((finding, index) => {
        doc.fontSize(10).text(`${index + 1}. ${finding.title}`);
        doc.text(`   Severity: ${finding.severity}`);
        doc.text(`   Status: ${finding.status}`);
        doc.text(`   Service: ${finding.service}`);
        doc.moveDown(0.5);
      });

      doc.end();
    });
  }

  async downloadReport(id: string) {
    return this.prisma.complianceReport.findUnique({
      where: { id },
    });
  }

  async getHistory(framework?: string) {
    const where = framework ? { framework: framework as any } : {};
    return this.prisma.complianceReport.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });
  }
}
