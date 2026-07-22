import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TaskCompletionsService } from './task-completions.service';
import {
  CreateTaskCompletionDto,
  UpdateTaskCompletionDto,
} from './dto/task-completion.dto';

@Controller('task-completions')
export class TaskCompletionsController {
  constructor(private readonly taskCompletions: TaskCompletionsService) {}

  @Post()
  create(@Body() dto: CreateTaskCompletionDto) {
    return this.taskCompletions.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskCompletionDto,
  ) {
    return this.taskCompletions.update(id, dto);
  }
}
