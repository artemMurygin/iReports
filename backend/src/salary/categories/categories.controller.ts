import { Controller, Get, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { GetCategoriesDto } from './dto/get-categories.dto';

@Controller('salary/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  getCategories(@Query() { direction }: GetCategoriesDto) {
    return this.categories.getCategories(direction);
  }
}
