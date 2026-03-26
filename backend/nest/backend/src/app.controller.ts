import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AppService } from './app.service';
import { CreateDto } from './dto/create.dto';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello/:name')
  getHello(@Param('name', ParseIntPipe) name: number): number {
    if (name !== 12) {
      throw new BadRequestException('Name must be 12');
    }

    return name;
    // this.appService.getHello() + ` ${name}`;
  }

  @UsePipes(new ValidationPipe())
  @Post('message')
  createMessage(@Body() dto: CreateDto) {
    console.log(`Message created! `);
  }
}
