import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.js';

/** Typed access to the validated environment. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get googleEnabled(): boolean {
    return Boolean(this.get('GOOGLE_CLIENT_ID') && this.get('GOOGLE_CLIENT_SECRET'));
  }
}
