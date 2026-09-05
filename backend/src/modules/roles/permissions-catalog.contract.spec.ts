import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROLES_PERMISSIONS } from './roles.permissions';
import type { PermissionCatalogEntry } from './application/ports/permission-registry.port';

// spec: roles#permission-catalog-from-code — CI-контракт из design.md
// (Decision 12): каждый permission-код, реально проверяемый в коде через
// `@RequirePermissions(...)`, обязан присутствовать в объединённом реестре
// модулей-владельцев (`<module>.permissions.ts`). Рассинхрон (использование
// строки без записи в каталоге) означает, что либо забыли завести право,
// либо опечатались в декораторе — оба случая должны падать на CI, а не
// проявляться в проде отсутствующим правом в админ-UI.
//
// Список ниже — та же явная агрегация, что и в RolesModule (providers →
// PERMISSION_REGISTRY): новый модуль-владелец добавляет свой реестр сюда
// одной строкой. Намеренно НЕ рантайм-сканирование файловой системы в
// поисках `*.permissions.ts` — Decision 12 явно отклоняет неявную "магию"
// в пользу изменения, видимого на ревью.
const MODULE_PERMISSION_REGISTRIES: PermissionCatalogEntry[][] = [
    ROLES_PERMISSIONS,
];

// backend/src — вычисляется от текущего файла (src/modules/roles/), а не
// через process.cwd(), чтобы тест не зависел от директории запуска jest.
const BACKEND_SRC_ROOT = join(__dirname, '..', '..');

const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'dist']);

const REQUIRE_PERMISSIONS_CALL_PATTERN = /@RequirePermissions\(([\s\S]*?)\)/g;
const STRING_LITERAL_PATTERN = /'([^'\\]*)'|"([^"\\]*)"/g;

function listSourceFiles(directory: string): string[] {
    const files: string[] = [];

    for (const entryName of readdirSync(directory)) {
        if (EXCLUDED_DIRECTORIES.has(entryName)) {
            continue;
        }

        const fullPath = join(directory, entryName);
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
            files.push(...listSourceFiles(fullPath));
            continue;
        }

        const isTypeScriptSource =
            entryName.endsWith('.ts') &&
            !entryName.endsWith('.spec.ts') &&
            !entryName.endsWith('.d.ts');
        if (isTypeScriptSource) {
            files.push(fullPath);
        }
    }

    return files;
}

// Статически обходит исходники backend/src/** в поиске всех использований
// `@RequirePermissions('...')` — regex-скан, а не AST/ts-morph, достаточен
// для декоратора с литеральными строковыми аргументами (design.md,
// Decision 12: коды ссылаются на `.code` констант, но на этапе выполнения
// это всё равно строковые литералы в исходнике).
function extractUsedPermissionCodes(files: string[]): Set<string> {
    const used = new Set<string>();

    for (const file of files) {
        const content = readFileSync(file, 'utf-8');

        for (const call of content.matchAll(REQUIRE_PERMISSIONS_CALL_PATTERN)) {
            const callArguments = call[1];
            for (const literal of callArguments.matchAll(
                STRING_LITERAL_PATTERN,
            )) {
                const code = literal[1] ?? literal[2];
                if (code) {
                    used.add(code);
                }
            }
        }
    }

    return used;
}

describe('permissions-catalog.contract (design.md Decision 12)', () => {
    const sourceFiles = listSourceFiles(BACKEND_SRC_ROOT);

    it('находит использования @RequirePermissions в backend/src (sanity-check самого сканера)', () => {
        expect(extractUsedPermissionCodes(sourceFiles).size).toBeGreaterThan(0);
    });

    it('каждый код из @RequirePermissions(...) присутствует в объединённом реестре модулей', () => {
        const registeredCodes = new Set(
            MODULE_PERMISSION_REGISTRIES.flat().map((entry) => entry.code),
        );
        const usedCodes = extractUsedPermissionCodes(sourceFiles);

        const missingFromRegistry = [...usedCodes].filter(
            (code) => !registeredCodes.has(code),
        );

        expect(missingFromRegistry).toEqual([]);
    });
});
