import { AIAnalysisResult, Clip, IAIAnalyzer } from '@/types/video';

export class MockAIAnalyzer implements IAIAnalyzer {
  async analyze(file: File, prompt: string): Promise<AIAnalysisResult> {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const clips: Clip[] = Array.from({ length: 10 }, (_, index) => {
      const startTime = index * 30;
      const endTime = startTime + 30;

      return {
        id: `mock-clip-${index + 1}`,
        title: `Mock Clip ${index + 1}`,
        startTime,
        endTime,
        duration: endTime - startTime,
        viralityScore: 70 + ((index * 7) % 31),
        status: 'pending',
      };
    });

    return { clips };
  }
}
