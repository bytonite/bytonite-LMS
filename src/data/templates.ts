
// Icons are stored as string names, not imported components

export interface Template {
    id: string;
    name: string;
    description: string;
    icon: string; 
    content: string;
}

export const templates: Template[] = [
    {
        id: 'grid-3-cols',
        name: 'Сетка: 3 колонки',
        description: 'Три равные колонки',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>`
    },
    {
        id: 'grid-1-left-2-right',
        name: 'Сетка: 1 слева, 2 справа',
        description: 'Левая большая, справа две',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-6 grid-row-2"></div><div class="grid-cell grid-span-6"></div><div class="grid-cell grid-span-6"></div></div>`
    },
    {
        id: 'grid-2x3',
        name: 'Сетка: Галерея 2x3',
        description: 'Шесть равных блоков',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>`
    },
    {
        id: 'grid-center-accent',
        name: 'Сетка: Центр акцент',
        description: 'Высокий блок в центре',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-6 grid-row-2"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div></div>`
    },
    {
        id: 'grid-2-top-3-bottom',
        name: 'Сетка: 2 сверху, 3 снизу',
        description: 'Комбинированная сетка',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-6"></div><div class="grid-cell grid-span-6"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>`
    },
    {
        id: 'grid-accent-top-left',
        name: 'Сетка: Акцент слева сверху',
        description: 'Широкий блок слева сверху',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-8"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>`
    },
    {
        id: 'grid-left-3-right',
        name: 'Сетка: Левая + 3 справа',
        description: 'Крупный блок слева и мелкие справа',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-6 grid-row-2"></div><div class="grid-cell grid-span-6"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div></div>`
    },
    {
        id: 'grid-complex-right',
        name: 'Сетка: Сложная правая',
        description: 'Асимметричная правая часть',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-6 grid-row-2"></div><div class="grid-cell grid-span-6"></div><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-2"></div></div>`
    },
    {
        id: 'grid-photo-gallery',
        name: 'Сетка: Панорама',
        description: 'Два широких в центре',
        icon: 'Layout',
        content: `<div class="dashboard-grid"><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-6"></div><div class="grid-cell grid-span-6"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div><div class="grid-cell grid-span-3"></div></div>`
    },
    // --- Callouts (from Obsidian) ---
    {
        id: 'callout-blank',
        name: 'Текст (Без фона)',
        description: 'Просто текст или заголовок',
        icon: 'Type',
        content: `> [!blank]\n> Ваш текст здесь`
    },
    // --- From Demo (Primary) ---
    {
        id: 'callout-note',
        name: 'Заметка (Note)',
        description: 'Стандартная заметка',
        icon: 'Pencil',
        content: `> [!note] Заметка
> Текст заметки...`
    },
    {
        id: 'callout-info',
        name: 'Инфо (Info)',
        description: 'Информация',
        icon: 'Info',
        content: `> [!info] Информация
> Полезная информация.`
    },
    {
        id: 'callout-important',
        name: 'Важное (Important)',
        description: 'Важная информация',
        icon: 'Flame',
        content: `> [!important] Важно
> обратите внимание!`
    },
    {
        id: 'callout-hint',
        name: 'Подсказка (Hint)',
        description: 'Совет или подсказка',
        icon: 'Zap',
        content: `> [!hint] Подсказка
> Полезный хак.`
    },
    {
        id: 'callout-question',
        name: 'Вопрос (Question)',
        description: 'Вопрос / FAQ',
        icon: 'HelpCircle',
        content: `> [!question] Вопрос
> Как это работает?`
    },
    {
        id: 'callout-warning',
        name: 'Предупреждение',
        description: 'Внимание',
        icon: 'AlertTriangle',
        content: `> [!warning] Внимание
> Будьте осторожны.`
    },
    {
        id: 'callout-error',
        name: 'Ошибка (Error)',
        description: 'Критическая ошибка',
        icon: 'AlertTriangle',
        content: `> [!error] Ошибка
> Что-то пошло не так.`
    },
    {
        id: 'callout-example',
        name: 'Пример (Example)',
        description: 'Пример кода/текста',
        icon: 'List',
        content: `> [!example] Пример
> Пример использования.`
    },

    // --- Extras (Useful standard ones) ---
    {
        id: 'callout-todo',
        name: 'Задача (Todo)',
        description: 'Чеклист',
        icon: 'CheckSquare',
        content: `> [!todo] Задачи
> - [ ] Сделать дело`
    },
    {
        id: 'callout-success',
        name: 'Успех (Success)',
        description: 'Выполнено',
        icon: 'CheckCircle',
        content: `> [!success] Успешно
> Операция завершена.`
    },
    {
        id: 'callout-quote',
        name: 'Цитата (Quote)',
        description: 'Цитата',
        icon: 'Quote',
        content: `> [!quote] Цитата\n> Слова великих.`
    },
    {
        id: 'code-block-auto',
        name: 'Код (Code)',
        description: 'Блок кода (Автоопределение)',
        icon: 'Code',
        content: `<div class="code-block-wrapper draggable-block" data-language="auto"><div class="code-block-content"><code>// Ваш код здесь</code></div></div>`
    },
    {
        id: 'mermaid-diagram',
        name: 'Диаграмма (Mermaid)',
        description: 'Блок для создания диаграмм (Mermaid)',
        icon: 'GitPullRequest',
        content: `<div class="mermaid-diagram-wrapper draggable-block" data-mermaid-code="graph TD;&#10;  A-->B;" contenteditable="false"><div class="mermaid-svg-container"></div></div>`
    }
];
