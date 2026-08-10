---
name: issues
description: Создает GitHub Issues и Milestones из файла плана. Использую, когда есть готовый план с фазами и нужно создать бэклог на GitHub.
---

# Plan Generator

Прочитай план из фаил $ARGUMENTS

Для каждой фазы создаем Milestone и Issues в GitHub, используя GHCLI.

## Порядок действий
1. Прочитай файл плана
2. Для каждой фазы создай milestone:
   `gh api repos/:owner/:repo/milestones -f title=" Фаза №: название"`
3. Для каждой задачи в фазе создай issue:
    `gh issue create --title "..." --body "..." --label "..." --milestone "..."`

## Формат Issue
**Title**: текст задачи из плана (без [])
**Body**: описание задачи