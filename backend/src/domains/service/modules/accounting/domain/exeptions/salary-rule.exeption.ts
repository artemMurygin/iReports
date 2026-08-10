import { ExceptionBase } from '@/shared/exceptions';

export class SalaryRuleExeption extends ExceptionBase {
    code: string;
    constructor(message: string) {
        super(message);
    }
}
