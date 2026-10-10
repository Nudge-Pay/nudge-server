import Joi from 'joi';
import globalSetup from './env.setup';
import { envValidationSchema } from '../src/config/env.validation';

describe('Test environment setup (test/env.setup.ts)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults every required variable and validates successfully with no error', () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }

    globalSetup();

    const result = envValidationSchema.validate(process.env, {
      abortEarly: false,
      allowUnknown: false,
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toBeDefined();
    const validated = result.value as Record<string, unknown>;
    expect(validated['NODE_ENV']).toBe('test');
    expect(validated['PORT']).toBe(3000);
  });

  it('fails with the missing key named if a new required schema variable is not defaulted', () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }

    globalSetup();

    const extendedSchema = envValidationSchema.concat(
      Joi.object({
        NEW_MANDATORY_VARIABLE: Joi.string().required(),
      }),
    );

    const { error } = extendedSchema.validate(process.env, {
      abortEarly: false,
      allowUnknown: false,
    });

    expect(error).toBeDefined();
    expect(error?.details).toBeDefined();
    const missingKeys = error?.details.map((d) => d.context?.key);
    expect(missingKeys).toContain('NEW_MANDATORY_VARIABLE');
    expect(error?.message).toContain('NEW_MANDATORY_VARIABLE');
  });

  it('restores the original process.env after tests complete', () => {
    expect(process.env).toEqual(originalEnv);
  });
});
