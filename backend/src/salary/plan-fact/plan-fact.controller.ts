import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PlanFactService } from './plan-fact.service';
import { PlanTargetsService } from './plan-targets.service';
import {
  BulkCreatePlanTargetsDto,
  PlanFactQueryDto,
  UpdatePlanTargetDto,
} from './dto/plan-fact.dto';

@Controller()
export class PlanFactController {
  constructor(
    private readonly planFact: PlanFactService,
    private readonly planTargets: PlanTargetsService,
  ) {}

  @Get('plan-fact')
  getTable(@Query() filter: PlanFactQueryDto) {
    return this.planFact.getTable(filter);
  }

  @Post('plan-targets')
  bulkCreate(@Body() dto: BulkCreatePlanTargetsDto) {
    return this.planTargets.bulkCreate(dto.items);
  }

  @Patch('plan-targets/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanTargetDto,
  ) {
    return this.planTargets.update(id, dto);
  }

  @Delete('plan-targets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.planTargets.delete(id);
  }
}
