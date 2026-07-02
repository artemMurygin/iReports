import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../../database/database.service';

const updateEmployeeSchema = z.object({
  roappOnlineName: z.string().min(1).nullable(),
});

@Controller('salary')
export class DirectoryController {
  constructor(private readonly db: DatabaseService) {}

  @Get('employees')
  getEmployees() {
    return this.db.bitrixEmployee.findMany({
      select: { id: true, firstName: true, lastName: true, departmentId: true, roappOnlineName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  @Get('departments')
  getDepartments() {
    return this.db.bitrixDepartment.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Patch('employees/:id')
  updateEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    const { roappOnlineName } = updateEmployeeSchema.parse(body);
    return this.db.bitrixEmployee.update({
      where: { id },
      data: { roappOnlineName },
      select: { id: true, firstName: true, lastName: true, departmentId: true, roappOnlineName: true },
    });
  }
}
