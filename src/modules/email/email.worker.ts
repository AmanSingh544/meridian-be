import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../shared/redis/redis.provider';
import { EmailService } from './email.service';
import { EmailJobData } from './email.queue';

@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<EmailJobData>;
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    this.worker = new Worker<EmailJobData>(
      'email',
      async (job: Job<EmailJobData>) => {
        await this.emailService.send(job.data);
      },
      { connection: this.redis },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Email job ${job.id} completed → ${job.data.to}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Email job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
