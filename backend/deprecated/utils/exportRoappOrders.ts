import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.service';

type Employee = { id: number; firstName: string; lastName: string } | null;

function toEmployee(e: Employee) {
  return e && { id: e.id, name: `${e.firstName} ${e.lastName}` };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const orders = await db.roappOrder.findMany({
    include: {
      status: true,
      orderType: true,
      manager: true,
      createdBy: true,
      closedBy: true,
      productsOrders: { include: { product: true, engineer: true } },
      serviceOrders: { include: { service: true, engineer: true } },
    },
  });

  const result = orders.map((order) => {
    const masters = new Map<number, ReturnType<typeof toEmployee>>();
    for (const p of order.productsOrders) {
      masters.set(p.engineer.id, toEmployee(p.engineer));
    }
    for (const s of order.serviceOrders) {
      masters.set(s.engineer.id, toEmployee(s.engineer));
    }

    return {
      id: order.id,
      label: order.label,
      status: order.status?.name ?? null,
      orderType: order.orderType?.name ?? null,
      manager: toEmployee(order.manager),
      createdBy: toEmployee(order.createdBy),
      closedBy: toEmployee(order.closedBy),
      payed: order.payed,
      cost: order.cost,
      engineerSalary: order.engineerSalary,
      managerSalary: order.managerSalary,
      createdAt: order.createdAt,
      doneAt: order.doneAt,
      closedAt: order.closedAt,
      masters: [...masters.values()],
      items: {
        products: order.productsOrders.map((p) => ({
          productId: p.productId,
          name: p.product.name,
          quantity: p.quantity,
          price: p.price,
          cost: p.cost,
          master: toEmployee(p.engineer),
        })),
        services: order.serviceOrders.map((s) => ({
          serviceId: s.serviceId,
          name: s.service.name,
          quantity: s.quantity,
          price: s.price,
          cost: s.cost,
          discount: s.discount,
          master: toEmployee(s.engineer),
        })),
      },
    };
  });

  const outputPath = join(process.cwd(), 'roapp-orders-export.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Сохранено ${result.length} заказов в ${outputPath}`);

  await app.close();
}

bootstrap();