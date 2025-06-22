export class OutputAnalyzer {
  private patterns = {
    starting: [
      /^Let me/i,
      /^I'll/i,
      /^I will/i,
      /^First,?\s+I/i,
      /^Starting/i,
      /^Okay,?\s+I/i,
      /^Sure,?\s+I/i,
    ],
    creating: [
      /creating/i,
      /writing/i,
      /adding/i,
      /implementing/i,
      /building/i,
      /generating/i,
    ],
    executing: [
      /running/i,
      /executing/i,
      /checking/i,
      /testing/i,
      /compiling/i,
      /installing/i,
    ],
    analyzing: [
      /analyzing/i,
      /looking at/i,
      /examining/i,
      /reading/i,
      /investigating/i,
      /understanding/i,
      /checking the/i,
    ],
    thinking: [
      /thinking/i,
      /considering/i,
      /planning/i,
      /Let me think/i,
    ],
    complete: [
      /completed/i,
      /done/i,
      /finished/i,
      /successfully/i,
      /ready/i,
      /that should/i,
      /you can now/i,
    ],
    waiting: [
      /\?$/,  // Ends with question
      /Would you like/i,
      /Should I/i,
      /Do you want/i,
      /Is that/i,
      /Does that/i,
    ],
    error: [
      /error/i,
      /failed/i,
      /issue/i,
      /problem/i,
      /unable to/i,
      /cannot/i,
    ]
  };

  analyzeOutput(text: string): { phase: string; status: string } {
    // Clean the text
    const cleanText = text.trim();
    if (!cleanText) return { phase: 'idle', status: '' };

    // Check for questions first (highest priority)
    for (const pattern of this.patterns.waiting) {
      if (pattern.test(cleanText)) {
        return { phase: 'waiting', status: 'Waiting for your response...' };
      }
    }

    // Check for completion
    for (const pattern of this.patterns.complete) {
      if (pattern.test(cleanText)) {
        return { phase: 'complete', status: 'Task completed' };
      }
    }

    // Check for errors
    for (const pattern of this.patterns.error) {
      if (pattern.test(cleanText)) {
        return { phase: 'working', status: 'Handling error...' };
      }
    }

    // Check for starting
    for (const pattern of this.patterns.starting) {
      if (pattern.test(cleanText)) {
        return { phase: 'thinking', status: 'Starting task...' };
      }
    }

    // Check specific activities
    for (const pattern of this.patterns.creating) {
      if (pattern.test(cleanText)) {
        // Extract what's being created
        const match = cleanText.match(/(?:creating|writing|adding|implementing|building)\s+(.+?)(?:\.|$)/i);
        const what = match ? match[1] : 'files';
        return { phase: 'working', status: `Creating ${what}...` };
      }
    }

    for (const pattern of this.patterns.executing) {
      if (pattern.test(cleanText)) {
        const match = cleanText.match(/(?:running|executing|testing|compiling)\s+(.+?)(?:\.|$)/i);
        const what = match ? match[1] : 'commands';
        return { phase: 'working', status: `Running ${what}...` };
      }
    }

    for (const pattern of this.patterns.analyzing) {
      if (pattern.test(cleanText)) {
        return { phase: 'thinking', status: 'Analyzing code...' };
      }
    }

    for (const pattern of this.patterns.thinking) {
      if (pattern.test(cleanText)) {
        return { phase: 'thinking', status: 'Thinking...' };
      }
    }

    // Default to working if we have text
    return { phase: 'working', status: 'Working...' };
  }

  // Calculate output rate over a time window
  calculateOutputRate(recentOutputs: Array<{ text: string; timestamp: Date }>, windowSeconds: number = 5): number {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);
    
    const recentChars = recentOutputs
      .filter(output => output.timestamp > windowStart)
      .reduce((sum, output) => sum + output.text.length, 0);
    
    return Math.round(recentChars / windowSeconds);
  }

  // Determine if Claude is still actively working based on output patterns
  isStillActive(lastOutput: string, timeSinceLastOutput: number): boolean {
    // If we're waiting for user input, we're not active
    for (const pattern of this.patterns.waiting) {
      if (pattern.test(lastOutput)) {
        return false;
      }
    }

    // If task is complete, we're not active
    for (const pattern of this.patterns.complete) {
      if (pattern.test(lastOutput)) {
        return false;
      }
    }

    // If no output for 30+ seconds, check if we should still show as active
    if (timeSinceLastOutput > 30000) {
      // If the last output was about starting something, stay active
      for (const pattern of [...this.patterns.starting, ...this.patterns.thinking]) {
        if (pattern.test(lastOutput)) {
          return true; // Still thinking
        }
      }
      
      // Otherwise, probably done
      return false;
    }

    // Recent output = still active
    return true;
  }
}