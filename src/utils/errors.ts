export enum ErrorCodes {
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  PARSE_ERROR = -32700,
}

export class MCPError extends Error {
  constructor(
    public code: ErrorCodes,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class BudibaseError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'BudibaseError';
  }

  toUserMessage(): string {
    switch (this.statusCode) {
      case 401:
        return 'Authentication failed. Please check your BUDIBASE_API_KEY is valid.';
      case 403:
        return 'Access denied. Your API key may not have permission for this operation.';
      case 404:
        return this.message.includes('Application') || this.message.includes('Table')
          ? this.message
          : 'Resource not found. Please verify the ID exists in Budibase.';
      case 429:
        return 'Rate limit exceeded. Please wait before making more requests.';
      case 500:
      case 502:
      case 503:
        return 'Budibase server error. The service may be temporarily unavailable.';
      default:
        if (this.message.includes('ECONNREFUSED') || this.message.includes('ENOTFOUND')) {
          return 'Cannot connect to Budibase. Please check BUDIBASE_URL is correct and the server is running.';
        }
        if (this.message.includes('timeout')) {
          return 'Request timed out. Budibase may be slow or unreachable.';
        }
        return this.message;
    }
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}