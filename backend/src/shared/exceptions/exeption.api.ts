export class ApiErrorResponse {
  readonly statusCode: number;
  readonly message: string;
  readonly error: string;
  readonly correlationId: string;
  readonly subErrors?: string[];

  constructor(body: ApiErrorResponse) {
    this.statusCode = body.statusCode;
    this.message = body.message;
    this.error = body.error;
    this.correlationId = body.correlationId;
    this.subErrors = body.subErrors;
  }
}
