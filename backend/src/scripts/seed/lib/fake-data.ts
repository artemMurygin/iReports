import { createRng, digits, pick } from './random';

const FIRST_NAMES = [
    'Александр',
    'Дмитрий',
    'Максим',
    'Сергей',
    'Андрей',
    'Алексей',
    'Иван',
    'Никита',
    'Егор',
    'Кирилл',
    'Михаил',
    'Артём',
    'Роман',
    'Владимир',
    'Анна',
    'Мария',
    'Елена',
    'Ольга',
    'Наталья',
    'Екатерина',
    'Юлия',
    'Дарья',
    'Виктория',
    'Софья',
    'Ксения',
] as const;

const LAST_NAMES = [
    'Иванов',
    'Смирнов',
    'Кузнецов',
    'Попов',
    'Соколов',
    'Лебедев',
    'Козлов',
    'Новиков',
    'Морозов',
    'Волков',
    'Соловьёв',
    'Васильев',
    'Зайцев',
    'Павлов',
    'Семёнов',
    'Голубев',
    'Виноградов',
    'Богданов',
    'Воробьёв',
    'Фёдоров',
] as const;

const GENERIC_MALFUNCTIONS = [
    'Не включается',
    'Разбит экран',
    'Не держит заряд',
    'Не работает камера',
    'Не заряжается',
    'Залит жидкостью',
    'Не работает динамик',
    'Плановое диагностическое обслуживание',
    'Не реагирует на нажатия',
    'Греется при работе',
] as const;

const GENERIC_NOTES = [
    'Комментарий менеджера к заказу',
    'Уточнить детали у клиента',
    'Стандартная обработка заказа',
    'См. вложения к заказу',
] as const;

export function fakePersonName(personKey: string): {
    firstName: string;
    lastName: string;
} {
    return {
        firstName: pick(FIRST_NAMES, personKey, ':first'),
        lastName: pick(LAST_NAMES, personKey, ':last'),
    };
}

export function fakeFullName(personKey: string): string {
    const { firstName, lastName } = fakePersonName(personKey);
    return `${lastName} ${firstName}`;
}

export function fakePhone(seed: string): string {
    return `+7900${digits(seed, 7, ':phone')}`;
}

export function fakeEmail(seed: string, hint?: string): string {
    const local =
        (hint ?? seed)
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '')
            .slice(0, 12) || 'user';
    return `${local}.${digits(seed, 4, ':email')}@example.com`;
}

export function fakeSerial(seed: string): string {
    const rng = createRng(seed + ':serial');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 10; i++) {
        out += alphabet[Math.floor(rng() * alphabet.length)];
    }
    return out;
}

export function fakeMalfunction(seed: string): string {
    return pick(GENERIC_MALFUNCTIONS, seed, ':malfunction');
}

export function fakeNote(seed: string): string {
    return pick(GENERIC_NOTES, seed, ':note');
}

export function fakeClientName(seed: string): string {
    return `Клиент №${digits(seed, 6, ':client')}`;
}
