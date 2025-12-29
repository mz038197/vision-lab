import React, { useMemo } from 'react';

interface TrainingChartProps {
  trainingLogs: { epoch: number; loss: number }[];
  maxEpochs?: number;
}

const TrainingChart: React.FC<TrainingChartProps> = ({ trainingLogs, maxEpochs = 100 }) => {
  const { chartData, maxLoss, minLoss } = useMemo(() => {
    if (trainingLogs.length === 0) {
      return { chartData: [], maxLoss: 2, minLoss: 0 };
    }

    // Sort by epoch and filter out invalid data (NaN, undefined, null)
    const sorted = [...trainingLogs]
      .filter(log => {
        return (
          log &&
          typeof log.epoch === 'number' &&
          typeof log.loss === 'number' &&
          !isNaN(log.epoch) &&
          !isNaN(log.loss) &&
          isFinite(log.epoch) &&
          isFinite(log.loss)
        );
      })
      .sort((a, b) => a.epoch - b.epoch);
    
    // If no valid data after filtering, return defaults
    if (sorted.length === 0) {
      return { chartData: [], maxLoss: 2, minLoss: 0 };
    }
    
    // Find min and max loss for scaling
    const losses = sorted.map(log => log.loss);
    const max = Math.max(...losses);
    const min = Math.min(...losses);
    
    // Add some padding to the range
    const range = max - min;
    const paddedMax = max + range * 0.1;
    const paddedMin = Math.max(0, min - range * 0.1);
    
    return {
      chartData: sorted,
      maxLoss: paddedMax || 2,
      minLoss: paddedMin || 0,
    };
  }, [trainingLogs]);

  // Chart dimensions
  const width = 480;
  const height = 240;
  const padding = { top: 20, right: 40, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scale functions
  const scaleX = (epoch: number) => {
    return (epoch / maxEpochs) * chartWidth + padding.left;
  };

  const scaleY = (loss: number) => {
    // Ensure valid numbers and avoid division by zero
    if (!isFinite(loss) || isNaN(loss)) return height - padding.bottom;
    if (maxLoss === minLoss) return height - padding.bottom - chartHeight / 2;
    
    const normalized = (loss - minLoss) / (maxLoss - minLoss);
    return height - padding.bottom - normalized * chartHeight;
  };

  // Generate path for line chart
  const linePath = useMemo(() => {
    if (chartData.length === 0) return '';
    
    const points = chartData.map((log, i) => {
      const x = scaleX(log.epoch);
      const y = scaleY(log.loss);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    });
    
    return points.join(' ');
  }, [chartData, maxLoss, minLoss, maxEpochs]);

  // Generate gradient area path
  const areaPath = useMemo(() => {
    if (chartData.length === 0) return '';
    
    const points = chartData.map((log) => {
      const x = scaleX(log.epoch);
      const y = scaleY(log.loss);
      return `${x},${y}`;
    });
    
    const firstX = scaleX(chartData[0].epoch);
    const lastX = scaleX(chartData[chartData.length - 1].epoch);
    const bottom = height - padding.bottom;
    
    return `M ${firstX} ${bottom} L ${points.join(' L ')} L ${lastX} ${bottom} Z`;
  }, [chartData, maxLoss, minLoss, maxEpochs]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const tickCount = 5;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const value = minLoss + (maxLoss - minLoss) * (i / tickCount);
      // Only add valid ticks
      if (isFinite(value) && !isNaN(value)) {
        ticks.push(value);
      }
    }
    return ticks.reverse();
  }, [maxLoss, minLoss]);

  // X-axis ticks
  const xTicks = useMemo(() => {
    const tickCount = 10;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      ticks.push((maxEpochs / tickCount) * i);
    }
    return ticks;
  }, [maxEpochs]);

  if (trainingLogs.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Training chart will appear here...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <h4 className="text-sm font-semibold text-gray-300 mb-2">Training Performance</h4>
      
      <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="lossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {yTicks.map((tick, i) => {
          const yPos = scaleY(tick);
          // Only render if position is valid
          if (!isFinite(yPos) || isNaN(yPos)) return null;
          
          return (
            <g key={`grid-${i}`}>
              <line
                x1={padding.left}
                y1={yPos}
                x2={width - padding.right}
                y2={yPos}
                stroke="#374151"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            </g>
          );
        })}

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#4B5563"
          strokeWidth="2"
        />

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#4B5563"
          strokeWidth="2"
        />

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => {
          const yPos = scaleY(tick);
          // Only render if position is valid
          if (!isFinite(yPos) || isNaN(yPos)) return null;
          
          return (
            <text
              key={`y-label-${i}`}
              x={padding.left - 10}
              y={yPos}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#9CA3AF"
              fontSize="11"
            >
              {tick.toFixed(2)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={`x-label-${i}`}
            x={scaleX(tick)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize="11"
          >
            {Math.round(tick)}
          </text>
        ))}

        {/* X-axis title */}
        <text
          x={width / 2}
          y={height - 5}
          textAnchor="middle"
          fill="#D1D5DB"
          fontSize="12"
          fontWeight="600"
        >
          Epoch
        </text>

        {/* Y-axis title */}
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          fill="#D1D5DB"
          fontSize="12"
          fontWeight="600"
          transform={`rotate(-90, 15, ${height / 2})`}
        >
          Loss
        </text>

        {/* Area under the curve */}
        {areaPath && (
          <path
            d={areaPath}
            fill="url(#lossGradient)"
          />
        )}

        {/* Line chart */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {chartData.map((log, i) => {
          const x = scaleX(log.epoch);
          const y = scaleY(log.loss);
          // Only render if coordinates are valid
          if (!isFinite(x) || !isFinite(y) || isNaN(x) || isNaN(y)) return null;
          
          return (
            <circle
              key={`point-${i}`}
              cx={x}
              cy={y}
              r="3"
              fill="#3B82F6"
              stroke="#1E3A8A"
              strokeWidth="2"
            />
          );
        })}

        {/* Latest point highlight */}
        {chartData.length > 0 && (() => {
          const lastPoint = chartData[chartData.length - 1];
          const x = scaleX(lastPoint.epoch);
          const y = scaleY(lastPoint.loss);
          
          // Only render if coordinates are valid
          if (!isFinite(x) || !isFinite(y) || isNaN(x) || isNaN(y)) return null;
          
          return (
            <circle
              cx={x}
              cy={y}
              r="5"
              fill="#3B82F6"
              stroke="#fff"
              strokeWidth="2"
            >
              <animate
                attributeName="r"
                values="5;7;5"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>loss</span>
          </div>
          {chartData.length > 0 && chartData[chartData.length - 1] && (
            <span>
              Latest: <span className="text-blue-400 font-semibold">
                {isFinite(chartData[chartData.length - 1].loss) && !isNaN(chartData[chartData.length - 1].loss)
                  ? chartData[chartData.length - 1].loss.toFixed(4)
                  : 'N/A'}
              </span>
            </span>
          )}
        </div>
        {chartData.length > 0 && chartData[chartData.length - 1] && (
          <span className="text-gray-500">
            Epoch {chartData[chartData.length - 1].epoch + 1} / {maxEpochs}
          </span>
        )}
      </div>
    </div>
  );
};

export default TrainingChart;

