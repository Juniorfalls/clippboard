import { RealAIAnalyzer } from './RealAIAnalyzer';
import { IAIAnalyzer } from '@/types/video';

export const getAIAnalyzer = (): IAIAnalyzer => {
  return new RealAIAnalyzer();
};
