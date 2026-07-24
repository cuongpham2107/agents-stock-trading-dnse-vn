// ==================== FAULT TOLERANCE ====================

export interface RetryConfig {
  maxRetries: number;
  retryOn: string[];
  backoffMs: number;
  backoffMultiplier: number;
}

export interface ErrorInfo {
  node: string;
  error: string;
  timestamp: number;
  retryCount: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryOn: ["rate_limit_error", "timeout_error", "network_error"],
  backoffMs: 1000,
  backoffMultiplier: 2,
};

// ==================== RETRY LOGIC ====================

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === retryConfig.maxRetries) {
        break;
      }

      const errorType = classifyError(lastError);
      if (!retryConfig.retryOn.includes(errorType)) {
        throw lastError;
      }

      const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt);
      console.log(`[Thử lại] Lần ${attempt + 1} that bailable. Đang thử lại sau ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// ==================== ERROR CLASSIFICATION ====================

export type ErrorType =
  | "rate_limit_error"
  | "timeout_error"
  | "network_error"
  | "auth_error"
  | "validation_error"
  | "unknown_error";

export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();

  if (message.includes("rate limit") || message.includes("429")) {
    return "rate_limit_error";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout_error";
  }
  if (message.includes("network") || message.includes("econnrefused")) {
    return "network_error";
  }
  if (message.includes("unauthorized") || message.includes("401")) {
    return "auth_error";
  }
  if (message.includes("validation") || message.includes("invalid")) {
    return "validation_error";
  }

  return "unknown_error";
}

// ==================== ERROR HANDLER NODE ====================

export async function errorHandlerNode(state: {
  error: string | null;
  retryCount: number;
}): Promise<{
  error: string | null;
  retryCount: number;
}> {
  if (!state.error) {
    return { error: null, retryCount: 0 };
  }

  console.log(`[ErrorHandler] Đang xử lý lỗi: ${state.error}`);
  console.log(`[ErrorHandler] Số lần thử lại: ${state.retryCount}`);

  return {
    error: null,
    retryCount: state.retryCount + 1,
  };
}

// ==================== FAULT TOLERANT WRAPPER ====================

export function withFaultTolerance<T>(
  fn: () => Promise<T>,
  nodeName: string,
  retryConfig?: Partial<RetryConfig>
): () => Promise<T> {
  return async () => {
    try {
      return await withRetry(fn, retryConfig);
    } catch (error) {
      console.error(`[FaultTolerance] ${nodeName} failed after retries: ${error}`);
      throw error;
    }
  };
}
