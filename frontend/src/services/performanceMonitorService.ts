/**
 * PERFORMANCE MONITOR SERVICE
 * Comprehensive performance monitoring and metrics collection
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  category: 'navigation' | 'api' | 'render' | 'memory' | 'user' | 'custom';
  tags?: Record<string, string>;
}

interface NavigationMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
}

interface APIMetrics {
  url: string;
  method: string;
  duration: number;
  status: number;
  size: number;
  timestamp: Date;
  cached: boolean;
}

interface RenderMetrics {
  componentName: string;
  renderTime: number;
  updateCount: number;
  propsSize: number;
  timestamp: Date;
}

interface UserInteractionMetric {
  type: 'click' | 'scroll' | 'input' | 'navigation';
  target: string;
  duration?: number;
  timestamp: Date;
}

interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

class PerformanceMonitorService {
  private metrics: PerformanceMetric[] = [];
  private apiMetrics: APIMetrics[] = [];
  private renderMetrics: RenderMetrics[] = [];
  private userInteractions: UserInteractionMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  
  private readonly MAX_METRICS = 1000;
  private readonly MAX_API_METRICS = 500;
  private readonly MAX_RENDER_METRICS = 200;
  private readonly MAX_INTERACTIONS = 100;
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  
  // Performance thresholds
  private readonly THRESHOLDS = {
    API_RESPONSE_TIME_WARNING: 2000, // 2 seconds
    API_RESPONSE_TIME_CRITICAL: 5000, // 5 seconds
    RENDER_TIME_WARNING: 16, // 16ms (60fps)
    RENDER_TIME_CRITICAL: 33, // 33ms (30fps)
    MEMORY_USAGE_WARNING: 0.8, // 80%
    MEMORY_USAGE_CRITICAL: 0.9, // 90%
    FCP_WARNING: 2500, // 2.5 seconds
    FCP_CRITICAL: 4000, // 4 seconds
    LCP_WARNING: 2500, // 2.5 seconds
    LCP_CRITICAL: 4000, // 4 seconds
    CLS_WARNING: 0.1,
    CLS_CRITICAL: 0.25,
    FID_WARNING: 100, // 100ms
    FID_CRITICAL: 300 // 300ms
  };

  constructor() {
    this.initializePerformanceObservers();
    this.collectNavigationMetrics();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectPeriodicMetrics();
    }, 30000); // Every 30 seconds

    // Setup user interaction tracking
    this.setupUserInteractionTracking();
    
    console.log('📊 Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('📊 Performance monitoring stopped');
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(
    name: string,
    value: number,
    category: PerformanceMetric['category'] = 'custom',
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      category,
      tags
    };

    this.metrics.push(metric);
    
    // Trim metrics if too many
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Check for alerts
    this.checkMetricThresholds(metric);
  }

  /**
   * Record API call metrics
   */
  recordAPICall(
    url: string,
    method: string,
    duration: number,
    status: number,
    size: number = 0,
    cached: boolean = false
  ): void {
    const apiMetric: APIMetrics = {
      url,
      method,
      duration,
      status,
      size,
      timestamp: new Date(),
      cached
    };

    this.apiMetrics.push(apiMetric);
    
    // Trim API metrics if too many
    if (this.apiMetrics.length > this.MAX_API_METRICS) {
      this.apiMetrics.shift();
    }

    // Record as general metric
    this.recordMetric(`api_${method.toLowerCase()}_duration`, duration, 'api', {
      url: url.split('?')[0], // Remove query params
      status: status.toString(),
      cached: cached.toString()
    });

    // Check API performance thresholds
    if (duration > this.THRESHOLDS.API_RESPONSE_TIME_CRITICAL) {
      this.triggerAlert('critical', 'api_response_time', duration, this.THRESHOLDS.API_RESPONSE_TIME_CRITICAL,
        `Critical API response time: ${duration}ms for ${method} ${url}`);
    } else if (duration > this.THRESHOLDS.API_RESPONSE_TIME_WARNING) {
      this.triggerAlert('warning', 'api_response_time', duration, this.THRESHOLDS.API_RESPONSE_TIME_WARNING,
        `Slow API response: ${duration}ms for ${method} ${url}`);
    }
  }

  /**
   * Record component render metrics
   */
  recordRender(
    componentName: string,
    renderTime: number,
    updateCount: number = 1,
    propsSize: number = 0
  ): void {
    const renderMetric: RenderMetrics = {
      componentName,
      renderTime,
      updateCount,
      propsSize,
      timestamp: new Date()
    };

    this.renderMetrics.push(renderMetric);
    
    // Trim render metrics if too many
    if (this.renderMetrics.length > this.MAX_RENDER_METRICS) {
      this.renderMetrics.shift();
    }

    // Record as general metric
    this.recordMetric('component_render_time', renderTime, 'render', {
      component: componentName,
      updates: updateCount.toString()
    });

    // Check render performance thresholds
    if (renderTime > this.THRESHOLDS.RENDER_TIME_CRITICAL) {
      this.triggerAlert('critical', 'render_time', renderTime, this.THRESHOLDS.RENDER_TIME_CRITICAL,
        `Critical render time: ${renderTime}ms for ${componentName}`);
    } else if (renderTime > this.THRESHOLDS.RENDER_TIME_WARNING) {
      this.triggerAlert('warning', 'render_time', renderTime, this.THRESHOLDS.RENDER_TIME_WARNING,
        `Slow render: ${renderTime}ms for ${componentName}`);
    }
  }

  /**
   * Record user interaction
   */
  recordUserInteraction(
    type: UserInteractionMetric['type'],
    target: string,
    duration?: number
  ): void {
    const interaction: UserInteractionMetric = {
      type,
      target,
      duration,
      timestamp: new Date()
    };

    this.userInteractions.push(interaction);
    
    // Trim interactions if too many
    if (this.userInteractions.length > this.MAX_INTERACTIONS) {
      this.userInteractions.shift();
    }

    // Record as general metric
    if (duration) {
      this.recordMetric(`user_${type}_duration`, duration, 'user', {
        target: target.substring(0, 50) // Limit target length
      });
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const now = new Date();
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Recent metrics
    const recentAPIMetrics = this.apiMetrics.filter(m => m.timestamp >= last5Minutes);
    const recentRenderMetrics = this.renderMetrics.filter(m => m.timestamp >= last5Minutes);
    
    // Calculate averages
    const avgAPIResponseTime = recentAPIMetrics.length > 0
      ? recentAPIMetrics.reduce((sum, m) => sum + m.duration, 0) / recentAPIMetrics.length
      : 0;
    
    const avgRenderTime = recentRenderMetrics.length > 0
      ? recentRenderMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentRenderMetrics.length
      : 0;

    // Navigation metrics
    const navigationMetrics = this.getNavigationMetrics();
    
    return {
      timestamp: now,
      navigation: navigationMetrics,
      api: {
        totalCalls: recentAPIMetrics.length,
        averageResponseTime: Math.round(avgAPIResponseTime),
        slowCalls: recentAPIMetrics.filter(m => m.duration > this.THRESHOLDS.API_RESPONSE_TIME_WARNING).length,
        errorRate: recentAPIMetrics.length > 0 
          ? recentAPIMetrics.filter(m => m.status >= 400).length / recentAPIMetrics.length 
          : 0,
        cacheHitRate: recentAPIMetrics.length > 0
          ? recentAPIMetrics.filter(m => m.cached).length / recentAPIMetrics.length
          : 0
      },
      rendering: {
        totalRenders: recentRenderMetrics.length,
        averageRenderTime: Math.round(avgRenderTime * 100) / 100,
        slowRenders: recentRenderMetrics.filter(m => m.renderTime > this.THRESHOLDS.RENDER_TIME_WARNING).length
      },
      memory: this.getMemoryMetrics(),
      alerts: this.alerts.filter(a => a.timestamp >= last5Minutes),
      userInteractions: this.userInteractions.filter(i => i.timestamp >= last5Minutes).length
    };
  }

  /**
   * Get detailed metrics
   */
  getDetailedMetrics() {
    return {
      allMetrics: this.metrics,
      apiMetrics: this.apiMetrics,
      renderMetrics: this.renderMetrics,
      userInteractions: this.userInteractions,
      alerts: this.alerts,
      thresholds: this.THRESHOLDS
    };
  }

  /**
   * Subscribe to performance alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Export performance data
   */
  exportData() {
    return {
      summary: this.getPerformanceSummary(),
      detailed: this.getDetailedMetrics(),
      exportTime: new Date(),
      monitoringDuration: this.isMonitoring ? 'active' : 'inactive'
    };
  }

  /**
   * Private methods
   */

  private initializePerformanceObservers(): void {
    // Performance Observer for navigation timing
    if ('PerformanceObserver' in window) {
      try {
        // Observe paint metrics
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-paint') {
              this.recordMetric('first_paint', entry.startTime, 'navigation');
            } else if (entry.name === 'first-contentful-paint') {
              this.recordMetric('first_contentful_paint', entry.startTime, 'navigation');
              
              // Check FCP threshold
              if (entry.startTime > this.THRESHOLDS.FCP_CRITICAL) {
                this.triggerAlert('critical', 'first_contentful_paint', entry.startTime, this.THRESHOLDS.FCP_CRITICAL,
                  `Critical First Contentful Paint: ${entry.startTime}ms`);
              } else if (entry.startTime > this.THRESHOLDS.FCP_WARNING) {
                this.triggerAlert('warning', 'first_contentful_paint', entry.startTime, this.THRESHOLDS.FCP_WARNING,
                  `Slow First Contentful Paint: ${entry.startTime}ms`);
              }
            }
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });

        // Observe LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          this.recordMetric('largest_contentful_paint', lastEntry.startTime, 'navigation');
          
          // Check LCP threshold
          if (lastEntry.startTime > this.THRESHOLDS.LCP_CRITICAL) {
            this.triggerAlert('critical', 'largest_contentful_paint', lastEntry.startTime, this.THRESHOLDS.LCP_CRITICAL,
              `Critical Largest Contentful Paint: ${lastEntry.startTime}ms`);
          } else if (lastEntry.startTime > this.THRESHOLDS.LCP_WARNING) {
            this.triggerAlert('warning', 'largest_contentful_paint', lastEntry.startTime, this.THRESHOLDS.LCP_WARNING,
              `Slow Largest Contentful Paint: ${lastEntry.startTime}ms`);
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Observe CLS
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          
          if (clsValue > 0) {
            this.recordMetric('cumulative_layout_shift', clsValue, 'navigation');
            
            // Check CLS threshold
            if (clsValue > this.THRESHOLDS.CLS_CRITICAL) {
              this.triggerAlert('critical', 'cumulative_layout_shift', clsValue, this.THRESHOLDS.CLS_CRITICAL,
                `Critical Cumulative Layout Shift: ${clsValue}`);
            } else if (clsValue > this.THRESHOLDS.CLS_WARNING) {
              this.triggerAlert('warning', 'cumulative_layout_shift', clsValue, this.THRESHOLDS.CLS_WARNING,
                `High Cumulative Layout Shift: ${clsValue}`);
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Observe FID
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fid = (entry as any).processingStart - entry.startTime;
            this.recordMetric('first_input_delay', fid, 'navigation');
            
            // Check FID threshold
            if (fid > this.THRESHOLDS.FID_CRITICAL) {
              this.triggerAlert('critical', 'first_input_delay', fid, this.THRESHOLDS.FID_CRITICAL,
                `Critical First Input Delay: ${fid}ms`);
            } else if (fid > this.THRESHOLDS.FID_WARNING) {
              this.triggerAlert('warning', 'first_input_delay', fid, this.THRESHOLDS.FID_WARNING,
                `High First Input Delay: ${fid}ms`);
            }
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

      } catch (error) {
        console.warn('Failed to initialize performance observers:', error);
      }
    }
  }

  private collectNavigationMetrics(): void {
    // Wait for page load to complete
    if (document.readyState === 'complete') {
      this.processNavigationTiming();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.processNavigationTiming(), 0);
      });
    }
  }

  private processNavigationTiming(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      const metrics = {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        domComplete: navigation.domComplete - navigation.fetchStart,
        responseTime: navigation.responseEnd - navigation.requestStart,
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnect: navigation.connectEnd - navigation.connectStart,
        serverResponse: navigation.responseStart - navigation.requestStart,
        pageLoad: navigation.loadEventEnd - navigation.fetchStart
      };

      // Record all navigation metrics
      Object.entries(metrics).forEach(([name, value]) => {
        if (value > 0) {
          this.recordMetric(`navigation_${name}`, value, 'navigation');
        }
      });
    }
  }

  private collectPeriodicMetrics(): void {
    // Collect memory metrics
    const memoryMetrics = this.getMemoryMetrics();
    if (memoryMetrics.usedJSHeapSize) {
      this.recordMetric('memory_used', memoryMetrics.usedJSHeapSize, 'memory');
      this.recordMetric('memory_total', memoryMetrics.totalJSHeapSize, 'memory');
      this.recordMetric('memory_limit', memoryMetrics.jsHeapSizeLimit, 'memory');
      
      // Check memory thresholds
      const memoryUsage = memoryMetrics.usedJSHeapSize / memoryMetrics.jsHeapSizeLimit;
      if (memoryUsage > this.THRESHOLDS.MEMORY_USAGE_CRITICAL) {
        this.triggerAlert('critical', 'memory_usage', memoryUsage, this.THRESHOLDS.MEMORY_USAGE_CRITICAL,
          `Critical memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
      } else if (memoryUsage > this.THRESHOLDS.MEMORY_USAGE_WARNING) {
        this.triggerAlert('warning', 'memory_usage', memoryUsage, this.THRESHOLDS.MEMORY_USAGE_WARNING,
          `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
      }
    }

    // Collect DOM metrics
    const domNodeCount = document.querySelectorAll('*').length;
    this.recordMetric('dom_nodes', domNodeCount, 'render');
  }

  private setupUserInteractionTracking(): void {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const targetDesc = target.tagName + (target.id ? `#${target.id}` : '') + 
                       (target.className ? `.${target.className.split(' ')[0]}` : '');
      this.recordUserInteraction('click', targetDesc);
    }, { passive: true });

    // Track scroll performance
    let scrollStart = 0;
    document.addEventListener('scroll', () => {
      if (scrollStart === 0) {
        scrollStart = performance.now();
      }
    }, { passive: true });

    document.addEventListener('scrollend', () => {
      if (scrollStart > 0) {
        const duration = performance.now() - scrollStart;
        this.recordUserInteraction('scroll', 'page', duration);
        scrollStart = 0;
      }
    }, { passive: true });
  }

  private getNavigationMetrics(): NavigationMetrics | null {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (!navigation) return null;

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: this.getMetricValue('first_paint'),
      firstContentfulPaint: this.getMetricValue('first_contentful_paint'),
      largestContentfulPaint: this.getMetricValue('largest_contentful_paint'),
      firstInputDelay: this.getMetricValue('first_input_delay'),
      cumulativeLayoutShift: this.getMetricValue('cumulative_layout_shift'),
      timeToInteractive: navigation.domInteractive - navigation.fetchStart
    };
  }

  private getMemoryMetrics() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
  }

  private getMetricValue(name: string): number {
    const metric = this.metrics.find(m => m.name === name);
    return metric ? metric.value : 0;
  }

  private checkMetricThresholds(_metric: PerformanceMetric): void {
    // Custom threshold checking logic can be added here
    // Most thresholds are checked when metrics are recorded
  }

  private triggerAlert(
    type: 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: number,
    message: string
  ): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      message,
      timestamp: new Date()
    };

    this.alerts.push(alert);
    
    // Trim alerts if too many
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Notify subscribers
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in performance alert callback:', error);
      }
    });

    console.warn(`🚨 Performance Alert [${type.toUpperCase()}]:`, message);
  }

  /**
   * Shutdown performance monitor
   */
  shutdown(): void {
    this.stopMonitoring();
    this.metrics = [];
    this.apiMetrics = [];
    this.renderMetrics = [];
    this.userInteractions = [];
    this.alerts = [];
    this.alertCallbacks = [];
    console.log('📊 Performance monitor shutdown');
  }
}

// Create singleton instance
export const performanceMonitorService = new PerformanceMonitorService();
export default performanceMonitorService;