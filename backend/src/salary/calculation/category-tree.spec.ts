import { collectSubtreeIds } from './category-tree';

describe('collectSubtreeIds', () => {
  const tree = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 1 },
    { id: 4, parentId: 2 },
    { id: 5, parentId: null }, // независимая ветка
  ];

  it('включает корень и всех потомков на всех уровнях вложенности', () => {
    expect(collectSubtreeIds(tree, 1)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('для листовой категории возвращает только её саму', () => {
    expect(collectSubtreeIds(tree, 4)).toEqual(new Set([4]));
  });

  it('не затрагивает несвязанные ветки дерева', () => {
    expect(collectSubtreeIds(tree, 1).has(5)).toBe(false);
  });

  it('работает со строковыми id (moy_sklad_product_folders)', () => {
    const strTree = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
    ];
    expect(collectSubtreeIds(strTree, 'a')).toEqual(new Set(['a', 'b']));
  });
});
