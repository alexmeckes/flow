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

  // Determine icon animation based on phase
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${getProgressAnimation()}`}>{getPhaseIcon()}</span>
          <span className="text-sm font-medium">{progressState.status}</span>
        </div>
        <span className="text-xs text-gray-400">{formattedTime}</span>
      </div>
    </div>
  );
};