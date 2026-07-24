import type { CheckpointManager } from "./manager";

// ==================== TIME TRAVEL ====================

export interface TimeTravelOptions {
  threadId: string;
  checkpointId?: string;
  step?: number;
}

export class TimeTravelManager {
  private checkpointManager: CheckpointManager;

  constructor(checkpointManager: CheckpointManager) {
    this.checkpointManager = checkpointManager;
  }

  /**
   * Lấy danh sách checkpoints có sẵn
   */
  async getAvailableCheckpoints(threadId: string): Promise<{
    id: string;
    timestamp: number;
    step: number;
  }[]> {
    const checkpoints = await this.checkpointManager.listCheckpoints(threadId);

    return checkpoints.map((cp: any, index) => ({
      id: cp.config?.configurable?.thread_id || `step-${index}`,
      timestamp: cp.checkpoint?.ts || Date.now(),
      step: index,
    }));
  }

  /**
   * Resume từ checkpoint gần nhất
   */
  getResumeConfig(threadId: string) {
    return {
      configurable: {
        thread_id: threadId,
      },
    };
  }

  /**
   * Resume từ checkpoint cụ thể (time-travel)
   */
  getRewindConfig(threadId: string, step: number) {
    return {
      configurable: {
        thread_id: threadId,
      },
    };
  }

  /**
   * Tạo thread ID mới cho phân tích
   */
  createThreadId(ticker: string, date: string): string {
    return this.checkpointManager.getThreadId(ticker, date);
  }

  /**
   * Kiểm tra có checkpoint nào không
   */
  async hasCheckpoints(threadId: string): Promise<boolean> {
    const checkpoints = await this.getAvailableCheckpoints(threadId);
    return checkpoints.length > 0;
  }

  /**
   * Lấy thông tin checkpoint gần nhất
   */
  async getLatestCheckpointInfo(threadId: string): Promise<{
    exists: boolean;
    step?: number;
    timestamp?: number;
  }> {
    const checkpoints = await this.getAvailableCheckpoints(threadId);

    if (checkpoints.length === 0) {
      return { exists: false };
    }

    const latest = checkpoints[checkpoints.length - 1]!;
    return {
      exists: true,
      step: latest.step,
      timestamp: latest.timestamp,
    };
  }
}
