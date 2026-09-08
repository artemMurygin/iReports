import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { ServicePriceChange } from './service-price-change.value-object';

describe('ServicePriceChange', () => {
    describe('create', () => {
        it('принимает валидную строку изменения цены', () => {
            const change = ServicePriceChange.create({
                serviceId: 42,
                price: 1500,
                serviceCost: 300,
            });

            expect(change.getServiceId()).toBe(42);
            expect(change.getPrice()).toBe(1500);
            expect(change.getServiceCost()).toBe(300);
        });

        it('принимает нулевые price/serviceCost (границы допустимы)', () => {
            const change = ServicePriceChange.create({
                serviceId: 1,
                price: 0,
                serviceCost: 0,
            });

            expect(change.getPrice()).toBe(0);
            expect(change.getServiceCost()).toBe(0);
        });

        it.each([0, -1, 1.5])(
            'отклоняет serviceId, не являющийся положительным целым: %s',
            (serviceId) => {
                withRequestContext(() => {
                    expect(() =>
                        ServicePriceChange.create({
                            serviceId,
                            price: 100,
                            serviceCost: 50,
                        }),
                    ).toThrow(ArgumentInvalidException);
                });
            },
        );

        it('отклоняет отрицательную price', () => {
            withRequestContext(() => {
                expect(() =>
                    ServicePriceChange.create({
                        serviceId: 1,
                        price: -1,
                        serviceCost: 50,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет отрицательную serviceCost', () => {
            withRequestContext(() => {
                expect(() =>
                    ServicePriceChange.create({
                        serviceId: 1,
                        price: 100,
                        serviceCost: -1,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });
});
