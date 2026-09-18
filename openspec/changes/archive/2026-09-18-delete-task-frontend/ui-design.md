# UI Design: delete-task-frontend

## Источник дизайна
- **.pen файл**: `design/sallary-first-iteration.pen` — не используется в этом изменении (см. «Отклонения от architecture.md»)
- **UI Kit**: фрейм `uDEum` — новых компонентов не требуется, переиспользуются существующие `IconButton` и `Modal`

---

## Экраны

Новых Pages/экранов нет — architecture.md перечисляет `pages/Tasks` как existing, без изменений. Видимое изменение полностью локализовано внутри уже существующей панели деталей задачи (`TaskDetailsPanel`, открывается поверх `pages/Tasks`), которая уже спроектирована и реализована.

| Page (из architecture.md) | Имя фрейма в .pen | Node ID | Breakpoints | Переиспользованные компоненты UI Kit | Статус |
|---|---|---|---|---|---|
| `pages/Tasks` | — (не менялся) | — | — | `IconButton`, `Modal` — существующие, без нового .pen-макета | не применимо |

## Ключевые состояния экранов

| Экран | Состояние | Как показано | Node ID |
|---|---|---|---|
| Заголовок `TaskStatusCard` | Обычное | Третья `IconButton` (`Trash2`, `variant="danger"`) рядом с существующими «Редактировать» (Pencil) и «Закрыть» (X) — точный визуальный прецедент этой комбинации уже в продакшне: `TaskCompletionRuleFields.tsx` (`IconButton variant="danger"` + `Trash2`) | — |
| `DeleteTaskDialog` | Ожидание подтверждения (idle) | `Modal` с заголовком «Удалить задачу «{title}»?», текстом-предупреждением о безвозвратности, кнопками «Отмена» (`variant="ghost"`) и «Удалить» (`variant="danger"`, иконка `Trash2`) — по образцу `DeleteRuleTaskDialog`/`DeleteMotivationSchemaDialog` | — |
| `DeleteTaskDialog` | Выполняется (`isPending`) | Кнопка подтверждения показывает `Loader2` вместо `Trash2`, недоступна повторному клику; закрытие диалога заблокировано | — |
| `DeleteTaskDialog` | Ошибка | Блок ошибки (`bg-danger-soft`, иконка `CircleX`) с сообщением из `ApiError`/`extractApiErrorMessage`; иконка кнопки подтверждения меняется на `RotateCw` (повторить) | — |

## Новые компоненты UI Kit

_Нет — `IconButton` и `Modal` уже существуют в UI Kit и используются как есть, без модификаций._

## Отклонения от architecture.md

Экраны не проектировались в Pencil (`design/sallary-first-iteration.pen`) — по решению пользователя, т.к. изменение не вводит новых страниц/состояний разметки: это точное повторение уже существующей в продакшне комбинации `IconButton(danger, Trash2)` + confirm-`Modal` (см. `TaskCompletionRuleFields.tsx`, `DeleteRuleTaskDialog.tsx`). Разметка описана текстом в разделе «Ключевые состояния экранов» выше и опирается на уже реализованные компоненты `shared/ui-kit`.

---

## Confirmation Checklist
- [x] Спроектированы все Pages из architecture.md — новых Pages нет, изменение локально внутри существующей панели
- [x] Везде, где был подходящий компонент UI Kit — использован существующий (`IconButton`, `Modal`), новый .pen-макет не создавался
- [x] Новых компонентов UI Kit нет
- [x] Overflow/clipping — не применимо (новой разметки страницы нет)
- [x] Пользователь согласовал отказ от Pencil-макета для этого изменения
- [x] Пользователь подтвердил переход к tasks.md
