import logger from '@/lib/logger';

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * Event Service
 *
 * Provides an event bus for inter-service communication using a pub/sub pattern.
 * Services can publish events and subscribe to events from other services.
 */
export class EventService {
  private readonly subscribers: Map<string, Set<EventHandler>> = new Map();
  private readonly logger = logger.withMetadata({ module: 'EventService' });

  constructor() {
    this.logger.info('EventService initialized');
  }

  /**
   * Subscribe to an event
   *
   * @param eventName Name of the event to subscribe to
   * @param handler Event handler function
   * @returns Unsubscribe function
   */
  subscribe<T>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }

    this.subscribers.get(eventName)!.add(handler as EventHandler);
    this.logger.debug(`Subscribed to event: ${eventName}`);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(eventName);
      if (handlers) {
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
          this.subscribers.delete(eventName);
        }
      }
    };
  }

  /**
   * Publish an event
   *
   * @param eventName Name of the event to publish
   * @param payload Event payload
   */
  async publish<T>(eventName: string, payload: T): Promise<void> {
    this.logger.debug(`Publishing event: ${eventName}`, {
      payloadKeys: Object.keys(payload as Record<string, unknown> || {})
    });

    const handlers = this.subscribers.get(eventName);
    if (!handlers || handlers.size === 0) {
      this.logger.debug(`No handlers for event: ${eventName}`);
      return;
    }

    const promises: Promise<void>[] = [];

    for (const handler of handlers) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        this.logger.error(`Error in event handler for ${eventName}`, {}, error);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
}

// Singleton instance
export const eventService = new EventService();