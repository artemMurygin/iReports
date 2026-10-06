import { Logger } from '@nestjs/common';
import { toError } from './logger/to-error';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class UploadLogger {
    private total = 0;
    private startTime = Date.now();
    private frame = 0;
    private interval: ReturnType<typeof setInterval> | null = null;
    private label: string;
    private readonly logger = new Logger('Sync');

    constructor(label: string) {
        this.label = label;
    }

    // Спиннер рисуется \r-перерисовкой и годится только для живого терминала:
    // в проде (Docker/Loki) он засорил бы stdout мусором из управляющих символов.
    private get spinnerEnabled(): boolean {
        return (
            Boolean(process.stdout.isTTY) &&
            process.env.NODE_ENV !== 'production'
        );
    }

    start() {
        this.startTime = Date.now();
        if (!this.spinnerEnabled) return;
        this.interval = setInterval(() => this.render(), 100);
        this.render();
    }

    tick(count: number) {
        this.total += count;
    }

    done() {
        this.stop();
        const durationMs = Date.now() - this.startTime;
        const sec = (durationMs / 1000).toFixed(1);
        if (this.spinnerEnabled) {
            // Затираем строку спиннера, чтобы итог не склеился с ним.
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
        }
        this.logger.log(
            { label: this.label, saved: this.total, durationMs },
            `${this.label}: сохранено ${this.total} за ${sec}с`,
        );
    }

    error(err: Error) {
        this.stop();
        if (this.spinnerEnabled) {
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
        }
        this.logger.error(
            { err: toError(err), label: this.label },
            `${this.label}: ошибка`,
        );
    }

    private render() {
        const spinner =
            CYAN + SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length] + RESET;
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        const line = `\r${spinner} ${BOLD}${this.label}${RESET} — сохранено ${BOLD}${this.total}${RESET} ${DIM}(${elapsed}с)${RESET}   `;
        process.stdout.write(line);
        this.frame++;
    }

    private stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
