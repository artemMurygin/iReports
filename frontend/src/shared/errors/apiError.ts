export class ApiError extends Error {
    constructor(errorString: string) {
        super(errorString)
    }
}
