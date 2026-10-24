import { Body, HttpStatus, PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { type ApiError, ErrorCode } from '@presidency-bingo/shared';
import { type ZodType, z } from 'zod';
import { ApiException } from './api.exception.js';

class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const exception = new ApiException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_FAILED,
      'Validation failed',
    );
    (exception.getResponse() as ApiError).issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw exception;
  }
}

/** Validates the request body with a shared Zod schema and documents it in Swagger. */
export function ZodBody(schema: ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key, index);
    if (key === undefined) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) return;
    const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
    // biome-ignore lint/suspicious/noExplicitAny: JSON Schema and Swagger's SchemaObject are compatible
    ApiBody({ schema: jsonSchema as any })(target, key, descriptor);
  };
}
