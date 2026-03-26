const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN  = '\x1b[36m';
const RED   = '\x1b[31m';
const DIM   = '\x1b[2m';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class UploadLogger {
    private total = 0;
    private startTime = Date.now();
    private frame = 0;
    private interval: ReturnType<typeof setInterval> | null = null;
    private label: string;

    constructor(label: string) {
        this.label = label;
    }

    start() {
        this.startTime = Date.now();
        this.interval = setInterval(() => this.render(), 100);
        this.render();
    }

    tick(count: number) {
        this.total += count;
    }

    done() {
        this.stop();
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        process.stdout.write(`\r${GREEN}${BOLD}✔${RESET} ${BOLD}${this.label}${RESET} — сохранено ${BOLD}${this.total}${RESET} записей ${DIM}за ${elapsed}с${RESET}\n`);
    }

    error(err: Error) {
        this.stop();
        process.stdout.write(`\r${RED}${BOLD}✖${RESET} ${BOLD}${this.label}${RESET} — ошибка: ${RED}${err.message}${RESET}\n`);
    }

    private render() {
        const spinner = CYAN + SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length] + RESET;
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