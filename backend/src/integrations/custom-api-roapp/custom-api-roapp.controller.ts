import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CustomApiRoappService } from './custom-api-roapp.service';

@Controller('custom-api-roapp')
export class CustomApiRoappController {
  constructor(private readonly customApiRoapp: CustomApiRoappService) {}

  @Post('create-service')
  createService(@Body() body: unknown) {
    return this.customApiRoapp.createService(body);
  }

  @Get('service-bonus/:id')
  getServiceBonusById(@Param('id', ParseIntPipe) id: number) {
    return this.customApiRoapp.getServiceBonusById(id);
  }
}
