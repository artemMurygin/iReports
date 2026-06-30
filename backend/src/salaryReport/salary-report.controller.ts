import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SalaryReportService } from './salary-report.service';
import {
  CreateDirectionDto,
  CreateTargetDto,
  UpdateTargetDto,
  CreateScaleDto,
  CreatePointDto,
  UpdatePointDto,
  CreateMotivationRuleDto,
  UpdateMotivationRuleDto,
  CreateRuleItemDto,
  UpdateRuleItemDto,
  CreatePlanDto,
  UpdatePlanDto,
  CreateFactDto,
  UpdateFactDto,
  CreateEmployeeRuleDto,
  MotivationQueryDto,
  PeriodQueryDto,
} from './dto';

@Controller('salary-report')
export class SalaryReportController {
  constructor(private readonly service: SalaryReportService) {}

  // ── Сид ────────────────────────────────────────────────────────────────
  @Post('seed')
  seed() {
    return this.service.seed();
  }

  // ── Направления ────────────────────────────────────────────────────────
  @Get('directions')
  findDirections() {
    return this.service.findAllDirections();
  }

  @Post('directions')
  createDirection(@Body() dto: CreateDirectionDto) {
    return this.service.createDirection(dto);
  }

  // ── Цели ───────────────────────────────────────────────────────────────
  @Get('targets')
  findTargets(@Query('directionId', new ParseIntPipe({ optional: true })) directionId?: number) {
    return this.service.findAllTargets(directionId);
  }

  @Post('targets')
  createTarget(@Body() dto: CreateTargetDto) {
    return this.service.createTarget(dto);
  }

  @Patch('targets/:id')
  updateTarget(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTargetDto) {
    return this.service.updateTarget(id, dto);
  }

  @Delete('targets/:id')
  removeTarget(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeTarget(id);
  }

  // ── Шкалы коэффициентов ────────────────────────────────────────────────
  @Get('scales')
  findScales() {
    return this.service.findAllScales();
  }

  @Post('scales')
  createScale(@Body() dto: CreateScaleDto) {
    return this.service.createScale(dto);
  }

  @Delete('scales/:id')
  removeScale(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeScale(id);
  }

  @Get('scales/:scaleId/points')
  findPoints(@Param('scaleId', ParseIntPipe) scaleId: number) {
    return this.service.findScalePoints(scaleId);
  }

  @Post('scales/:scaleId/points')
  createPoint(@Param('scaleId', ParseIntPipe) scaleId: number, @Body() dto: CreatePointDto) {
    return this.service.createPoint(scaleId, dto);
  }

  @Patch('points/:id')
  updatePoint(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePointDto) {
    return this.service.updatePoint(id, dto);
  }

  @Delete('points/:id')
  removePoint(@Param('id', ParseIntPipe) id: number) {
    return this.service.removePoint(id);
  }

  // ── Правила мотивации ──────────────────────────────────────────────────
  @Get('rules')
  findRules(@Query('directionId', new ParseIntPipe({ optional: true })) directionId?: number) {
    return this.service.findAllRules(directionId);
  }

  @Post('rules')
  createRule(@Body() dto: CreateMotivationRuleDto) {
    return this.service.createRule(dto);
  }

  @Patch('rules/:id')
  updateRule(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMotivationRuleDto) {
    return this.service.updateRule(id, dto);
  }

  @Delete('rules/:id')
  removeRule(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeRule(id);
  }

  // ── Строки правила ─────────────────────────────────────────────────────
  @Get('rules/:ruleId/items')
  findRuleItems(@Param('ruleId', ParseIntPipe) ruleId: number) {
    return this.service.findRuleItems(ruleId);
  }

  @Post('rules/:ruleId/items')
  createRuleItem(@Param('ruleId', ParseIntPipe) ruleId: number, @Body() dto: CreateRuleItemDto) {
    return this.service.createRuleItem(ruleId, dto);
  }

  @Patch('rule-items/:id')
  updateRuleItem(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRuleItemDto) {
    return this.service.updateRuleItem(id, dto);
  }

  @Delete('rule-items/:id')
  removeRuleItem(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeRuleItem(id);
  }

  // ── План ───────────────────────────────────────────────────────────────
  @Get('plans')
  findPlans(
    @Query('period') periodStr?: string,
    @Query('directionId', new ParseIntPipe({ optional: true })) directionId?: number,
  ) {
    const period = periodStr ? new Date(periodStr) : undefined;
    return this.service.findPlans(period, directionId);
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.service.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  removePlan(@Param('id', ParseIntPipe) id: number) {
    return this.service.removePlan(id);
  }

  // ── Факт ───────────────────────────────────────────────────────────────
  @Get('facts')
  findFacts(
    @Query('period') periodStr?: string,
    @Query('directionId', new ParseIntPipe({ optional: true })) directionId?: number,
  ) {
    const period = periodStr ? new Date(periodStr) : undefined;
    return this.service.findFacts(period, directionId);
  }

  @Post('facts')
  createFact(@Body() dto: CreateFactDto) {
    return this.service.createFact(dto);
  }

  @Patch('facts/:id')
  updateFact(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFactDto) {
    return this.service.updateFact(id, dto);
  }

  @Delete('facts/:id')
  removeFact(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeFact(id);
  }

  // ── Расчёт мотивации ───────────────────────────────────────────────────
  @Get('motivation')
  getMotivation(@Query() query: MotivationQueryDto) {
    return this.service.getMotivation(query);
  }

  // ── Привязка сотрудников ───────────────────────────────────────────────
  @Get('employee-rules')
  findEmployeeRules(@Query('ruleId', new ParseIntPipe({ optional: true })) ruleId?: number) {
    return this.service.findEmployeeRules(ruleId);
  }

  @Post('employee-rules')
  createEmployeeRule(@Body() dto: CreateEmployeeRuleDto) {
    return this.service.createEmployeeRule(dto);
  }

  @Delete('employee-rules/:id')
  removeEmployeeRule(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeEmployeeRule(id);
  }

  // ── Результаты ─────────────────────────────────────────────────────────
  @Get('results')
  findResults(@Query('period') periodStr?: string) {
    const period = periodStr ? new Date(periodStr) : undefined;
    return this.service.findResults(period);
  }
}
