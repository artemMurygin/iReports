#!/usr/bin/env node
// Валидатор ссылок `spec: <capability-path>#<anchor>` из кода на openspec/specs/**.
// Конвенция: openspec/specs/conventions/documentation/spec.md
//
// Использование: node openspec/scripts/validate-spec-refs.mjs [dir...]
// По умолчанию сканирует backend/src и frontend/src.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Файл лежит в <repo>/openspec/scripts/, поэтому до корня репозитория — на два уровня выше.
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const IGNORED_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'generated'])

// Требует, чтобы `spec:` встречался внутри комментария (`//` или `*` перед ним на той же строке).
const SPEC_REF_PATTERN = /(?:\/\/|\*)\s*spec:\s*(\S+)/g
const SPEC_ID_PATTERN = /^([a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)#([^\s#]+)$/

function walk(dir, onFile) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
        if (IGNORED_DIR_NAMES.has(entry)) continue
        const fullPath = join(dir, entry)
        const stats = statSync(fullPath)
        if (stats.isDirectory()) {
            walk(fullPath, onFile)
        } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
            onFile(fullPath)
        }
    }
}

function findSpecRefs(filePath) {
    const refs = []
    const lines = readFileSync(filePath, 'utf8').split('\n')
    lines.forEach((line, index) => {
        for (const match of line.matchAll(SPEC_REF_PATTERN)) {
            refs.push({ file: filePath, line: index + 1, raw: match[1] })
        }
    })
    return refs
}

// GitHub-style heading slug: lower-case, вырезать пунктуацию (кроме букв/цифр/пробела/дефиса
// в любом языке), пробелы -> дефисы. Дубликаты внутри файла нумеруются "-1", "-2", ... как в GitHub.
//
// Это собственная приближённая реализация, а не github-slugger — самосогласована с валидатором
// (он использует ровно эту же функцию и для генерации, и для проверки id), но в редких случаях
// может не побайтово совпасть с якорем, который реально покажет GitHub при рендере spec.md в
// браузере. Если это когда-нибудь станет проблемой — подключить github-slugger вместо этой функции.
function slugify(headingText) {
    return headingText
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-')
}

function extractAnchors(specFilePath) {
    const content = readFileSync(specFilePath, 'utf8')
    const seen = new Map()
    const anchors = new Set()
    for (const line of content.split('\n')) {
        const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/)
        if (!headingMatch) continue
        const baseSlug = slugify(headingMatch[1])
        const count = seen.get(baseSlug) ?? 0
        seen.set(baseSlug, count + 1)
        anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`)
    }
    return anchors
}

// Сначала главное дерево specs/<path>/spec.md, затем delta-спек любого активного/архивного change
// (openspec/changes/*/specs/<path>/spec.md) — см.
// openspec/specs/conventions/documentation/spec.md, Requirement: Валидация ссылок из кода на спеки.
function resolveSpecFile(capabilityPath) {
    const mainPath = join(REPO_ROOT, 'openspec', 'specs', capabilityPath, 'spec.md')
    if (existsSync(mainPath)) return mainPath

    const changesDir = join(REPO_ROOT, 'openspec', 'changes')
    if (!existsSync(changesDir)) return null

    const candidateChangeDirs = []
    for (const entry of readdirSync(changesDir)) {
        const entryPath = join(changesDir, entry)
        if (!statSync(entryPath).isDirectory()) continue
        candidateChangeDirs.push(entryPath)
        if (entry === 'archive' && statSync(entryPath).isDirectory()) {
            for (const archivedEntry of readdirSync(entryPath)) {
                const archivedPath = join(entryPath, archivedEntry)
                if (statSync(archivedPath).isDirectory()) candidateChangeDirs.push(archivedPath)
            }
        }
    }

    for (const changeDir of candidateChangeDirs) {
        const deltaPath = join(changeDir, 'specs', capabilityPath, 'spec.md')
        if (existsSync(deltaPath)) return deltaPath
    }
    return null
}

function main(scanDirs) {
    const dirsToScan = scanDirs.length > 0 ? scanDirs : ['backend/src', 'frontend/src']
    const allRefs = []
    for (const dir of dirsToScan) {
        walk(resolve(REPO_ROOT, dir), (filePath) => {
            allRefs.push(...findSpecRefs(filePath))
        })
    }

    const anchorsCache = new Map()
    const errors = []

    for (const ref of allRefs) {
        const idMatch = ref.raw.match(SPEC_ID_PATTERN)
        const relFile = relative(REPO_ROOT, ref.file)
        if (!idMatch) {
            errors.push(
                `${relFile}:${ref.line}: неверный формат spec-ссылки "${ref.raw}" — ожидается "<capability-path>#<anchor>"`,
            )
            continue
        }

        const [, capabilityPath, anchor] = idMatch
        const specFile = resolveSpecFile(capabilityPath)
        if (!specFile) {
            errors.push(
                `${relFile}:${ref.line}: capability-path "${capabilityPath}" не найден ни в openspec/specs/, ни в openspec/changes/*/specs/`,
            )
            continue
        }

        if (!anchorsCache.has(specFile)) {
            anchorsCache.set(specFile, extractAnchors(specFile))
        }
        const anchors = anchorsCache.get(specFile)
        if (!anchors.has(anchor)) {
            errors.push(
                `${relFile}:${ref.line}: якорь "${anchor}" не найден в ${relative(REPO_ROOT, specFile)}`,
            )
        }
    }

    if (errors.length > 0) {
        console.error(`Найдено ${errors.length} невалидных spec-ссылок:\n`)
        for (const error of errors) console.error(`  ${error}`)
        process.exit(1)
    }

    console.log(`OK: проверено ${allRefs.length} spec-ссылок в ${dirsToScan.join(', ')}`)
}

main(process.argv.slice(2))
