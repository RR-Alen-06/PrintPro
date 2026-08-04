import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err: any) {
      if (err instanceof ZodError || err.name === 'ZodError') {
        const issues = err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json({
          success: false,
          error: `Validation error: ${issues.join('; ')}`,
          details: err.errors
        });
      }
      next(err);
    }
  };
};

export default validateRequest;
