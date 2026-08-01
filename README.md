# bytonite-v1

> Markdown-редактор с визуальным конструктором страниц, режимом Live Preview и синхронизацией кода

## 🚀 Текущая версия: 1.20

---

## 📋 История версий

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.18
- Фикс: исправлено мигание/исчезновение подсветки в Live Preview
- Полностью переработана логика подсветки активного элемента — теперь используется `useLayoutEffect` (запускается синхронно после каждого рендера DOM)
- Подсветка теперь сохраняется при любом ре-рендере ReactMarkdown
- Редактор: убрано требование `hasFocus` для синхронизации курсора

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.17
- Фикс: кнопки сетки и ячейки теперь корректно подсвечиваются в Live Preview при клике
- Добавлен плагин `remarkInjectSourcePos` — точные координаты теперь внедряются во все теги HTML-блоков
- Синхронизация кода ↔ превью работает для любых вложенных структур

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.16
- Центрирование панели кнопок (`.header-actions`) в верхней панели
- Увеличены иконки верхней панели до `22px`, высота панели до `48px`
- Увеличены иконки создания файлов/папок до `20px`
- Увеличен размер статус-бара и ползунка ширины контента до `200px`

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.15
- Добавлен ресайзер боковой панели

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.14
- Добавлен Drag Handle (зеленый маркер) для перетаскивания блоков в Design Mode

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.13
- Фикс: восстановлена зеленая рамка выделения блоков в Design Mode
- Фикс: синхронизация `data-sourcepos` — поиск ближайшего родителя с координатами

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.12
- Фикс: устранена потеря данных при переключении файлов
- Фикс: исправлен бесконечный цикл автосохранения в Design Mode
- Таймеры автосохранения привязаны к конкретным файлам

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.11
- Фикс: исправлена логика индикатора Drag & Drop
- Точное математическое определение позиции вставки относительно блоков

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.10
- Фикс: критический баг с потерей данных и "одинаковыми" заметками устранён

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.9
- Визуальная подсветка контейнеров при Drag & Drop
- Расширен список контейнеров: `.callout, blockquote, .flex-row, .flex-col, td, th`

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.8
- Фикс Drag & Drop для новых блоков через `MutationObserver`
- Редактирование текста и перетаскивание через Drag Handle

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.7
- Мультивыделение через `Ctrl+Click` вместо `Shift+Click`

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.6
- Снятие выделения кликом по пустой области в Design Mode

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.5
- Удаление нижнего отступа у вложенных сеток

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.4
- Фикс: отступ при вертикальном ресайзе ячейки сетки

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.3
- Фикс: сброс выделения при мультивыборе через `skipNextSyncRef`

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.2
- Добавлено мультивыделение блоков (`Shift+Click`), `PropertiesPanel`

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.1
- Фикс прокрутки заметки (`box-sizing: border-box`)

### Versija 1.19
- Obnovlenije koda i ispravlenija

### Версия 1.0
- Фикс вставки элементов во вложенные grid-сетки

---

## ⚡ Запуск

```bash
npm install
npm run dev:server   # только веб-версия (порт 5173)
npm run dev          # веб + Electron
```

## 🛠 Технологии

- **React 18** + TypeScript
- **CodeMirror 6** — редактор кода
- **ReactMarkdown** + rehype-raw — рендер Markdown
- **Vite** — сборка
- **Electron** — десктоп-версия