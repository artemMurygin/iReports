import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SalaryRulesService } from './salary-rules.service';
import {
  CreateSalaryRuleDto,
  SalaryRuleQueryDto,
  UpdateSalaryRuleDto,
} from './dto/salary-rule.dto';

@Controller('salary-rules')
export class SalaryRulesController {
  constructor(private readonly rules: SalaryRulesService) {}

  @Get()
  findAll(@Query() filter: SalaryRuleQueryDto) {
    return this.rules.findAll(filter);
  }

  @Post()
  create(@Body() dto: CreateSalaryRuleDto) {
    return this.rules.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalaryRuleDto,
  ) {
    return this.rules.update(id, dto);
  }

  @Post(':id/archive')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.rules.archive(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rules.remove(id);
  }
}
