import { HttpException, HttpStatus } from '@nestjs/common';

export class AppErrorHandler {
  static handle(err: any, context: string = 'Application'): never {
    const message = err?.message ?? 'Unknown error';
    console.error(`[${context}]`, err);

    if (message.includes('Unexpected token')) {
      throw new HttpException(
        { message: 'Invalid JSON format.', context },
        HttpStatus.BAD_REQUEST,
      );
    }

    throw new HttpException(
      { message: `Unexpected error in ${context}.`, context },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
