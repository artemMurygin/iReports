import { Body, Controller, Post } from '@nestjs/common';
import { CustomApiRoappService } from './custom-api-roapp.service';
import { CreateServiceDto } from './dto/createService-custom-api-roapp.dto';

@Controller('custom-api-roapp')
export class CustomApiRoappController {
  constructor(private readonly customApiRoapp: CustomApiRoappService) {}

  @Post('create-service')
  createService(@Body() body: CreateServiceDto) {
    return this.customApiRoapp.createService(body);
  }
}