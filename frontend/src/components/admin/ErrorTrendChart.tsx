import React, { useMemo } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import './ErrorTrendChart.css';

export interface ErrorTrendChartProps {
  data: number[];
  labels?: string[];
  title: string;
  timeRange: 'hourly' | 'daily' | 'weekly';
  height?: number;
  showGrid?: boolean;
  showPoints?: boolean;
  color?: string;
  fillArea?: boolean;
  onDataPointClick?: (index: number, value: number) => void;
}

const ErrorTrendChart: React.FC<ErrorTrendChartProps> = ({
  data,
  labels,
  title,
  timeRange,
  height = 200,
  showGrid = true,
  showPoints = true,
  color = 'var(--interactive-primary)',
  fillArea = false,
  onDataPointClick
}) => {
  // Calculate chart dimensions and scales
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;
    
    const chartWidth = 400;
    const chartHeight = height - 40; // Account for padding
    
    const points = data.map((value, index) => ({
      x: (index / (data.length - 1)) * chartWidth,
      y: chartHeight - ((value - minValue) / range) * chartHeight,
      value,
      index
    }));

    return {
      points,
      maxValue,
      minValue,
      range,
      chartWidth,
      chartHeight
    };
  }, [data, height]);

  // Generate time labels if not provided
  const timeLabels = useMemo(() => {
    if (labels) return labels;
    
    const now = new Date();
    return data.map((_, index) => {
      let date: Date;
      
      switch (timeRange) {
        case 'hourly':
          date = new Date(now.getTime() - (data.length - 1 - index) * 60 * 60 * 1000);
          return date.getHours().toString().padStart(2, '0') + ':00';
        case 'daily':
          date = new Date(now.getTime() - (data.length - 1 - index) * 24 * 60 * 60 * 1000);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        case 'weekly':
          date = new Date(now.getTime() - (data.length - 1 - index) * 7 * 24 * 60 * 60 * 1000);
          return `W${Math.ceil(date.getDate() / 7)}`;
        default:
          return index.toString();
      }
    });
  }, [data, labels, timeRange]);

  // Calculate trend direction
  const trendDirection = useMemo(() => {
    if (data.length < 2) return 'stable';
    
    const recent = data.slice(-Math.ceil(data.length / 3));
    const earlier = data.slice(0, Math.ceil(data.length / 3));
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;
    
    const threshold = 0.1; // 10% change threshold
    const change = (recentAvg - earlierAvg) / (earlierAvg || 1);
    
    if (change > threshold) return 'increasing';
    if (change < -threshold) return 'decreasing';
    return 'stable';
  }, [data]);

  const getTrendIcon = (direction: string): string => {
    switch (direction) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  };

  const getTrendColor = (direction: string): string => {
    switch (direction) {
      case 'increasing': return 'var(--color-loss)';
      case 'decreasing': return 'var(--color-profit)';
      default: return 'var(--color-neutral)';
    }
  };

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const handlePointClick = (point: { index: number; value: number }) => {
    onDataPointClick?.(point.index, point.value);
  };

  if (!chartData || data.length === 0) {
    return (
      <Card>
        <CardHeader title={title} />
        <CardContent>
          <div className="chart-empty">
            <div className="chart-empty-icon">📊</div>
            <div className="chart-empty-text">No data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="error-trend-chart">
      <CardHeader 
        title={title}
        action={
          <div className="trend-indicator">
            <span 
              className="trend-icon"
              style={{ color: getTrendColor(trendDirection) }}
            >
              {getTrendIcon(trendDirection)}
            </span>
            <span 
              className="trend-text"
              style={{ color: getTrendColor(trendDirection) }}
            >
              {trendDirection.toUpperCase()}
            </span>
          </div>
        }
      />
      <CardContent>
        <div className="chart-container">
          {/* Chart Statistics */}
          <div className="chart-stats">
            <div className="chart-stat">
              <span className="chart-stat-label">Max:</span>
              <span className="chart-stat-value">{formatValue(chartData.maxValue)}</span>
            </div>
            <div className="chart-stat">
              <span className="chart-stat-label">Min:</span>
              <span className="chart-stat-value">{formatValue(chartData.minValue)}</span>
            </div>
            <div className="chart-stat">
              <span className="chart-stat-label">Avg:</span>
              <span className="chart-stat-value">
                {formatValue(data.reduce((sum, val) => sum + val, 0) / data.length)}
              </span>
            </div>
            <div className="chart-stat">
              <span className="chart-stat-label">Total:</span>
              <span className="chart-stat-value">
                {formatValue(data.reduce((sum, val) => sum + val, 0))}
              </span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="chart-svg-container" style={{ height: `${height}px` }}>
            <svg 
              className="chart-svg" 
              viewBox={`0 0 ${chartData.chartWidth} ${height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid Lines */}
              {showGrid && (
                <g className="chart-grid">
                  {/* Horizontal grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                    const y = 20 + ratio * chartData.chartHeight;
                    return (
                      <line
                        key={`h-${ratio}`}
                        x1="0"
                        y1={y}
                        x2={chartData.chartWidth}
                        y2={y}
                        stroke="var(--border-secondary)"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      />
                    );
                  })}
                  
                  {/* Vertical grid lines */}
                  {chartData.points.map((point, index) => {
                    if (index % Math.ceil(chartData.points.length / 6) === 0) {
                      return (
                        <line
                          key={`v-${index}`}
                          x1={point.x}
                          y1="20"
                          x2={point.x}
                          y2={20 + chartData.chartHeight}
                          stroke="var(--border-secondary)"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                        />
                      );
                    }
                    return null;
                  })}
                </g>
              )}

              {/* Area Fill */}
              {fillArea && (
                <path
                  d={`M 0,${20 + chartData.chartHeight} ${chartData.points.map(p => `L ${p.x},${p.y + 20}`).join(' ')} L ${chartData.chartWidth},${20 + chartData.chartHeight} Z`}
                  fill={color}
                  fillOpacity="0.1"
                />
              )}

              {/* Trend Line */}
              <polyline
                points={chartData.points.map(p => `${p.x},${p.y + 20}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points */}
              {showPoints && chartData.points.map((point, index) => (
                <g key={index}>
                  <circle
                    cx={point.x}
                    cy={point.y + 20}
                    r="4"
                    fill={color}
                    stroke="var(--bg-primary)"
                    strokeWidth="2"
                    className="chart-point"
                    onClick={() => handlePointClick(point)}
                    style={{ cursor: onDataPointClick ? 'pointer' : 'default' }}
                  />
                  
                  {/* Hover tooltip */}
                  <g className="chart-tooltip" opacity="0">
                    <rect
                      x={point.x - 25}
                      y={point.y + 20 - 35}
                      width="50"
                      height="25"
                      fill="var(--bg-primary)"
                      stroke="var(--border-primary)"
                      strokeWidth="1"
                      rx="4"
                    />
                    <text
                      x={point.x}
                      y={point.y + 20 - 18}
                      textAnchor="middle"
                      fontSize="12"
                      fill="var(--text-primary)"
                    >
                      {formatValue(point.value)}
                    </text>
                  </g>
                </g>
              ))}

              {/* Y-axis labels */}
              <g className="chart-y-labels">
                {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                  const y = 20 + ratio * chartData.chartHeight;
                  const value = chartData.maxValue - (ratio * chartData.range);
                  return (
                    <text
                      key={`y-${ratio}`}
                      x="-5"
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="var(--text-secondary)"
                    >
                      {formatValue(value)}
                    </text>
                  );
                })}
              </g>
            </svg>

            {/* X-axis labels */}
            <div className="chart-x-labels">
              {timeLabels.map((label, index) => {
                if (index % Math.ceil(timeLabels.length / 6) === 0 || index === timeLabels.length - 1) {
                  const x = (index / (timeLabels.length - 1)) * 100;
                  return (
                    <div
                      key={index}
                      className="chart-x-label"
                      style={{ left: `${x}%` }}
                    >
                      {label}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ErrorTrendChart;