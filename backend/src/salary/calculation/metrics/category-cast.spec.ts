import { castCategoryExtId } from './category-cast';
import { Direction } from '../../../../prisma/generated/prisma/schema/client';

describe('castCategoryExtId', () => {
  it('SERVICE: парсит categoryExtId в целое число (id roapp_service_categories)', () => {
    expect(castCategoryExtId(Direction.SERVICE, '909016')).toBe(909016);
    expect(typeof castCategoryExtId(Direction.SERVICE, '909016')).toBe(
      'number',
    );
  });

  it('SERVICE: бросает ошибку на нечисловой categoryExtId', () => {
    expect(() => castCategoryExtId(Direction.SERVICE, 'abc')).toThrow();
  });

  it('SHOP: оставляет categoryExtId строкой (id moy_sklad_product_folders)', () => {
    const id = 'f6407351-95d8-11ee-0a80-139800143030';
    expect(castCategoryExtId(Direction.SHOP, id)).toBe(id);
    expect(typeof castCategoryExtId(Direction.SHOP, id)).toBe('string');
  });
});
