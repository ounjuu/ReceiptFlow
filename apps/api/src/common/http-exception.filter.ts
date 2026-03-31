import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
        error = exception.message;
      } else {
        const resObj = res as Record<string, unknown>;
        message =
          (resObj.message as string) ||
          (Array.isArray(resObj.message)
            ? (resObj.message as string[]).join(", ")
            : exception.message);
        error = (resObj.error as string) || exception.message;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "서버 내부 오류가 발생했습니다";
      error = "Internal Server Error";
    }

    const body = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${message}`,
    );

    if (status === HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
      this.logger.error(exception.stack);
    }

    response.status(status).json(body);
  }
}
