import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StructuredLoggingService } from '../../common/services/structured-logging/structured-logging.service';

/** Counts components in the common SBOM formats. */
export function componentCount(format: string, doc: Record<string, unknown>): number {
  if (format === 'spdx-json') return Array.isArray(doc.packages) ? doc.packages.length : 0;
  if (format === 'cyclonedx-json') return Array.isArray(doc.components) ? doc.components.length : 0;
  return Array.isArray(doc.artifacts) ? doc.artifacts.length : 0; // syft-json
}

@Injectable()
export class SbomService {
  constructor(private readonly prisma: PrismaService, private readonly logging: StructuredLoggingService) {}

  async store(image: string, format: string, document: Record<string, unknown>, createdBy: string, service?: string) {
    const sbom = await this.prisma.sbom.create({
      data: { image, format, service, document: document as object, componentCount: componentCount(format, document), createdBy },
      select: { id: true, image: true, service: true, format: true, componentCount: true, createdAt: true },
    });
    await this.logging.logAuditEvent('sbom.stored', `SBOM for ${image} (${sbom.componentCount} components)`, { actor: createdBy, entityType: 'sbom', entityId: sbom.id });
    return sbom;
  }

  list(image?: string) {
    return this.prisma.sbom.findMany({
      where: image ? { image: { contains: image } } : {},
      select: { id: true, image: true, service: true, format: true, componentCount: true, createdBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(id: string) {
    const sbom = await this.prisma.sbom.findUnique({ where: { id } });
    if (!sbom) throw new NotFoundException('SBOM not found');
    return sbom;
  }
}
