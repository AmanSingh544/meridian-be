import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [TeamController],
})
export class TeamModule {}
