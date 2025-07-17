/**
 * EVENT BUS SERVICE
 * Centralized event distribution system for WebSocket events
 */

interface EventListener<T = any> {
  id: string;
  callback: (data: T) => void;
  priority: number;
  once: boolean;
}

interface EventQueue {
  eventType: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}

interface EventValidationRule {
  eventType: string;
  validator: (data: any) => boolean;
  transformer?: (data: any) => any;
}

class EventBusService {
  private listeners: Map<string, EventListener[]> = new Map();
  private eventQueue: EventQueue[] = [];
  private validationRules: Map<string, EventValidationRule> = new Map();
  private isProcessingQueue = false;
  private maxQueueSize = 1000;
  private maxRetries = 3;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupDefaultValidationRules();
    this.startQueueProcessor();
  }

  /**
   * Subscribe to events with optional priority and validation
   */
  subscribe<T = any>(
    eventType: string,
    callback: (data: T) => void,
    options: {
      priority?: number;
      once?: boolean;
      id?: string;
    } = {}
  ): string {
    const listenerId = options.id || this.generateListenerId();
    const listener: EventListener<T> = {
      id: listenerId,
      callback,
      priority: options.priority || 0,
      once: options.once || false
    };

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.push(listener);

    // Sort by priority (higher priority first)
    eventListeners.sort((a, b) => b.priority - a.priority);

    console.log(`📡 Subscribed to event '${eventType}' with ID '${listenerId}'`);
    return listenerId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, listenerId: string): boolean {
    const eventListeners = this.listeners.get(eventType);
    if (!eventListeners) return false;

    const index = eventListeners.findIndex(listener => listener.id === listenerId);
    if (index === -1) return false;

    eventListeners.splice(index, 1);

    // Clean up empty event types
    if (eventListeners.length === 0) {
      this.listeners.delete(eventType);
    }

    console.log(`📡 Unsubscribed from event '${eventType}' with ID '${listenerId}'`);
    return true;
  }

  /**
   * Emit event immediately or queue if components not ready
   */
  emit(eventType: string, data: any, options: { immediate?: boolean } = {}): void {
    // Validate event data
    if (!this.validateEvent(eventType, data)) {
      console.warn(`📡 Event validation failed for '${eventType}':`, data);
      return;
    }

    // Transform data if transformer exists
    const transformedData = this.transformEventData(eventType, data);

    if (options.immediate || this.hasActiveListeners(eventType)) {
      this.emitImmediate(eventType, transformedData);
    } else {
      this.queueEvent(eventType, transformedData);
    }
  }

  /**
   * Emit event immediately to all listeners
   */
  private emitImmediate(eventType: string, data: any): void {
    const eventListeners = this.listeners.get(eventType);
    if (!eventListeners || eventListeners.length === 0) {
      return;
    }

    const listenersToRemove: string[] = [];

    for (const listener of eventListeners) {
      try {
        listener.callback(data);

        // Mark one-time listeners for removal
        if (listener.once) {
          listenersToRemove.push(listener.id);
        }
      } catch (error) {
        console.error(`📡 Error in event listener for '${eventType}':`, error);
      }
    }

    // Remove one-time listeners
    listenersToRemove.forEach(id => {
      this.unsubscribe(eventType, id);
    });

    console.log(`📡 Emitted event '${eventType}' to ${eventListeners.length} listeners`);
  }

  /**
   * Queue event for later processing
   */
  private queueEvent(eventType: string, data: any): void {
    if (this.eventQueue.length >= this.maxQueueSize) {
      // Remove oldest events to make room
      this.eventQueue.shift();
      console.warn('📡 Event queue full, removing oldest event');
    }

    this.eventQueue.push({
      eventType,
      data,
      timestamp: new Date(),
      retryCount: 0
    });

    console.log(`📡 Queued event '${eventType}' (queue size: ${this.eventQueue.length})`);
  }

  /**
   * Process queued events
   */
  private processEventQueue(): void {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];

    for (const queuedEvent of eventsToProcess) {
      if (this.hasActiveListeners(queuedEvent.eventType)) {
        this.emitImmediate(queuedEvent.eventType, queuedEvent.data);
      } else if (queuedEvent.retryCount < this.maxRetries) {
        // Requeue with incremented retry count
        queuedEvent.retryCount++;
        this.eventQueue.push(queuedEvent);
      } else {
        console.warn(`📡 Dropping event '${queuedEvent.eventType}' after ${this.maxRetries} retries`);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.processingInterval = setInterval(() => {
      this.processEventQueue();
    }, 1000); // Process queue every second
  }

  /**
   * Check if event type has active listeners
   */
  private hasActiveListeners(eventType: string): boolean {
    const listeners = this.listeners.get(eventType);
    return listeners !== undefined && listeners.length > 0;
  }

  /**
   * Validate event data
   */
  private validateEvent(eventType: string, data: any): boolean {
    const rule = this.validationRules.get(eventType);
    if (!rule) return true; // No validation rule means valid

    try {
      return rule.validator(data);
    } catch (error) {
      console.error(`📡 Event validation error for '${eventType}':`, error);
      return false;
    }
  }

  /**
   * Transform event data if transformer exists
   */
  private transformEventData(eventType: string, data: any): any {
    const rule = this.validationRules.get(eventType);
    if (!rule || !rule.transformer) return data;

    try {
      return rule.transformer(data);
    } catch (error) {
      console.error(`📡 Event transformation error for '${eventType}':`, error);
      return data;
    }
  }

  /**
   * Add validation rule for event type
   */
  addValidationRule(eventType: string, validator: (data: any) => boolean, transformer?: (data: any) => any): void {
    this.validationRules.set(eventType, {
      eventType,
      validator,
      transformer
    });
  }

  /**
   * Setup default validation rules
   */
  private setupDefaultValidationRules(): void {
    // Price update validation
    this.addValidationRule('price_update', (data) => {
      return data && 
             typeof data.symbol === 'string' && 
             typeof data.price === 'number' && 
             typeof data.exchange === 'string';
    });

    // Account status update validation
    this.addValidationRule('account_status_update', (data) => {
      return data && 
             typeof data.accountId === 'string' && 
             typeof data.isActive === 'boolean';
    });

    // Market indices validation
    this.addValidationRule('indices_update', (data) => {
      return data && 
             Array.isArray(data.indices) && 
             data.timestamp;
    });

    // Order update validation
    this.addValidationRule('order_update', (data) => {
      return data && 
             typeof data.orderId === 'string' && 
             typeof data.status === 'string';
    });

    // Connection status validation
    this.addValidationRule('connection_status', (data) => {
      return data && 
             typeof data.connected === 'boolean';
    });
  }

  /**
   * Generate unique listener ID
   */
  private generateListenerId(): string {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get event bus statistics
   */
  getStats(): any {
    const listenerCounts = new Map<string, number>();
    for (const [eventType, listeners] of this.listeners.entries()) {
      listenerCounts.set(eventType, listeners.length);
    }

    return {
      totalEventTypes: this.listeners.size,
      totalListeners: Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0),
      queuedEvents: this.eventQueue.length,
      validationRules: this.validationRules.size,
      listenersByEventType: Object.fromEntries(listenerCounts),
      isProcessingQueue: this.isProcessingQueue,
      maxQueueSize: this.maxQueueSize
    };
  }

  /**
   * Clear all listeners and queued events
   */
  clear(): void {
    this.listeners.clear();
    this.eventQueue = [];
    console.log('📡 Event bus cleared');
  }

  /**
   * Shutdown event bus
   */
  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.clear();
    console.log('📡 Event bus shutdown');
  }
}

// Create singleton instance
export const eventBusService = new EventBusService();
export default eventBusService;