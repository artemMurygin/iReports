import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import type {
    BitrixEmployeeLookupPort,
    BitrixEmployeeSnapshot,
} from '../../application/ports/bitrix-employee-lookup.port';

@Injectable()
export class BitrixEmployeeLookupRepository implements BitrixEmployeeLookupPort {
    constructor(private readonly db: DatabaseService) {}

    async findById(
        bitrixEmployeeId: number,
    ): Promise<BitrixEmployeeSnapshot | null> {
        const record = await this.db.bitrixEmployee.findUnique({
            where: { id: bitrixEmployeeId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                isActive: true,
            },
        });
        return record;
    }
}
