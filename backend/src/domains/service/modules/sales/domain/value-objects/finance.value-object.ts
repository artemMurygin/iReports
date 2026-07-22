import { ValueObject } from '@/shared/domain/value-object.base';

export type FinanceProps = {
  cost: number | null;
  payed: number | null;
  discountSum: number | null;
  engineerSalary: number | null;
  managerSalary: number | null;
};

export class Finance extends ValueObject<FinanceProps> {
  getCost() {
    return this.props.cost;
  }

  getPayed() {
    return this.props.payed;
  }

  getDiscountSum() {
    return this.props.discountSum;
  }

  getEngineerSalary() {
    return this.props.engineerSalary;
  }

  getManagerSalary() {
    return this.props.managerSalary;
  }

  getBalance() {
    return (this.props.cost ?? 0) - (this.props.payed ?? 0);
  }

  getTotalSalary() {
    return (this.props.engineerSalary ?? 0) + (this.props.managerSalary ?? 0);
  }
}
