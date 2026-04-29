import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailQueue } from './email.queue';
import { EmailWorker } from './email.worker';

@Global()
@Module({
  providers: [EmailService, EmailQueue, EmailWorker],
  exports: [EmailService, EmailQueue],
})
export class EmailModule {}
