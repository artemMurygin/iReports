/**
 * Pencil `Q7v9pt` (`Панель · Детализация задачи`) — каждая секция карточки задачи подписана
 * одним и тем же стилем лейбла (`L`-узлы: «ОПИСАНИЕ», «ДЕДЛАЙН», «ОТВЕТСТВЕННЫЙ», «ЗАРПЛАТНОЕ
 * ПРАВИЛО», «ССЫЛКИ», «КОММЕНТАРИИ» — 10px/700, letterSpacing 0.4, `ink-muted`, заглавные).
 * Вынесено сюда, а не продублировано в каждом файле, — используется в `TaskStatusCard.tsx`,
 * `TaskLinksSection.tsx`, `TaskCommentsSection.tsx`. Текст в разметке остаётся обычным регистром
 * (`uppercase` только визуально), чтобы исходники оставались читаемой кириллицей.
 */
export const SECTION_LABEL_CLASS = 'font-ui text-[10px] font-bold tracking-[0.4px] text-ink-muted uppercase'
