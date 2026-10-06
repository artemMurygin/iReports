/** Креденшелы сервисного аккаунта Google из env (общие для Sheets и Drive). */
export function getGoogleServiceAccountCredentials() {
    return {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // env хранит \n как литерал — восстанавливаем реальные переносы
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
}
