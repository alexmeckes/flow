import React, { useMemo } from 'react';
import { ProgressState } from '../types';

interface ProgressIndicatorProps {
  progressState?: ProgressState;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progressState }) => {
  const { elapsedTime, formattedTime } = useMemo(() => {
    if (!progressState?.startTime) return { elapsedTime: 0, formattedTime: '0s' };
    
    const elapsed = Date.now() - new Date(progressState.startTime).getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    
    let formatted = '';
    if (minutes > 0) {
      formatted = `${minutes}m ${seconds % 60}s`;
    } else {
      formatted = `${seconds}s`;
    }
    
    return { elapsedTime: elapsed, formattedTime: formatted };
  }, [progressState?.startTime, progressState?.lastOutputTime]);

  if (!progressState || !progressState.isActive) {
    return null;
  }

  // Determine progress bar animation based on phase
  const getProgressAnimation = () => {
    switch (progressState.phase) {
      case 'thinking':
        return 'animate-pulse';
      case 'working':
        return 'animate-pulse';
      case 'waiting':
        return '';
      case 'complete':
        return '';
      default:
        return 'animate-pulse';
    }
  };

  // Determine progress bar color based on phase
  const getProgressColor = () => {
    switch (progressState.phase) {
      case 'thinking':
        return 'bg-blue-500';
      case 'working':
        return 'bg-green-500';
      case 'waiting':
        return 'bg-yellow-500';
      case 'complete':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Get phase icon
  const getPhaseIcon = () => {
    switch (progressState.phase) {
      case 'thinking':
        return '🤔';
      case 'working':
        return '⚡';
      case 'waiting':
        return '⏳';
      case 'complete':
        return '✓';
      default:
        return '⏱️';
    }
  };

  return (
    <div className="mt-2 p-3 bg-claude-surface rounded-lg border border-claude-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getPhaseIcon()}</span>
          <span className="text-sm font-medium">{progressState.status}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {progressState.outputRate > 0 && (
            <span>{progressState.outputRate} chars/s</span>
          )}
          <span>{formattedTime}</span>
        </div>
      </div>
      
      <div className="w-full h-1 bg-claude-bg rounded-full overflow-hidden">
        <div 
          className={`h-full ${getProgressColor()} ${getProgressAnimation()} transition-all duration-300`}
          style={{
            width: progressState.phase === 'complete' ? '100%' : '60%',
            opacity: progressState.phase === 'waiting' ? 0.5 : 1
          }}
        />
      </div>
    </div>
  );
};