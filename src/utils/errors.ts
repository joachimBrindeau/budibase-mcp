export enum ErrorCodes {
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
}

export class MCPError extends Error {
  constructor(
    public code: ErrorCodes,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class BudibaseError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'BudibaseError';
  }

  toUserMessage(): string {
    switch (this.statusCode) {
      case 401:
        return 'Authentication failed. Check your BUDIBASE_API_KEY. Try: check_connection';
      case 403:
        return 'Access denied. Your API key may lack permissions. Try: check_connection';
      case 404:
        return this.message.includes('Application') || this.message.includes('Table')
          ? `${this.message}. Try: list_applications or list_tables to find valid IDs`
          : 'Resource not found. Try: list_applications, list_tables, or query_records to find valid IDs';
      case 429:
        return 'Rate limit exceeded. Wait before retrying, or reduce batch size/concurrency.';
      case 500:
      case 502:
      case 503:
        return 'Budibase server error. Service may be temporarily unavailable. Try: check_connection';
      default:
        if (this.message.includes('ECONNREFUSED') || this.message.includes('ENOTFOUND')) {
          return 'Cannot connect to Budibase. Check BUDIBASE_URL and server status. Try: check_connection';
        }
        if (this.message.includes('timeout')) {
          return 'Request timed out. Try smaller batch sizes or check server with check_connection.';
        }
        return this.message;
    }
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
