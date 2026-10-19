import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Maps Prisma errors to HTTP responses in the same shape Nest uses. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Duplicate resource'],
      P2025: [HttpStatus.NOT_FOUND, 'Resource not found'],
      P2003: [HttpStatus.BAD_REQUEST, 'Related resource does not exist'],
    };
    const [statusCode, message] = map[exception.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Database error'];
    res.status(statusCode).json({ statusCode, message, error: exception.code });
  }
}
