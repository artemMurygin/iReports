import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { CreateRewardDto, UpdateRewardDto } from './dto/reward.dto';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Post()
  create(@Body() dto: CreateRewardDto) {
    return this.rewards.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRewardDto) {
    return this.rewards.update(id, dto);
  }
}
