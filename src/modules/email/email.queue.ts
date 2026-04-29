import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../shared/redis/redis.provider';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailQueue implements OnModuleDestroy {
  private readonly queue: Queue<EmailJobData>;

  constructor(@Inject(REDIS_CLIENT) redis: Redis) {
    this.queue = new Queue<EmailJobData>('email', { connection: redis });
  }

  async add(data: EmailJobData): Promise<void> {
    await this.queue.add('send', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
