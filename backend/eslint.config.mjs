// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['eslint.config.mjs', 'deprecated/**'],
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
                // tsconfig.json лежит рядом, в корне backend/, но явное указание project
                // (вместо автопоиска projectService вверх по дереву) оставлено для надёжности.
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
            // singleQuote/tabWidth/trailingComma продублированы из .prettierrc явно, чтобы не зависеть
            // от того, найдёт ли eslint-plugin-prettier файл поиском вверх от линтуемого файла.
            'prettier/prettier': ['error', { endOfLine: 'auto', singleQuote: true, tabWidth: 4, trailingComma: 'all' }],
        },
    },
);
