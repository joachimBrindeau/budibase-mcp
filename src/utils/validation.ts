import { z } from 'zod';
import { ValidationError } from './errors';

export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join('.'),
        firstError.code
      );
    }
    throw error;
  }
};

// Common schemas
export const AppIdSchema = z.string().min(1, 'App ID or name is required');
export const TableIdSchema = z.string().min(1, 'Table ID or name is required');
export const RecordIdSchema = z.string().min(1, 'Record ID is required');
export const EmailSchema = z.string().email('Invalid email format');