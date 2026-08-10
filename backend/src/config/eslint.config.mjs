// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['eslint.config.mjs', '../../deprecated/**'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            sourceType: 'commonjs',
            parserOptions: {
                // Файл tsconfig.json лежит рядом (в src/config), но линтуемые файлы — в ../../src,
                // поэтому автопоиск ближайшего tsconfig.json (projectService) вверх по дереву
                // директорий его не найдёт. Указываем путь явно.
                project: ['./tsconfig.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            // Параметр интерфейса, намеренно не используемый конкретной
            // реализацией (например SalaryRule.calculate(context) в
            // правиле, ещё не читающем context, — см. Фазу 1 плана
            // payroll-calculation) отмечается префиксом `_`, а не
            // вычёркивается из сигнатуры целиком.
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' },
            ],
            // singleQuote/tabWidth/trailingComma продублированы из .prettierrc: eslint-plugin-prettier
            // резолвит .prettierrc поиском вверх от линтуемого файла и не найдёт файл, лежащий
            // в соседней (не родительской) директории src/config.
            'prettier/prettier': ['error', { endOfLine: 'auto', singleQuote: true, tabWidth: 4, trailingComma: 'all' }],
        },
    },
);
