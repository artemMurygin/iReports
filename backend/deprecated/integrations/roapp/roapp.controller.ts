import { Controller, Get } from '@nestjs/common';
import { RoappService } from './roapp.service';

@Controller('roapp')
export class RoappController {
  constructor(private readonly roapp: RoappService) {}

  @Get('service-categories')
  getServiceCategories() {
    return this.roapp.fetchAllServiceCategories();
  }
}
