// Classification configuration for two-phase system
export const CLASSIFICATION_CONFIG = {
  phase1: {
    enabled: true,
    confidenceThreshold: 0.70,
    fallbackCategory: 'Other',
    // Pattern matching confidence levels
    senderDomainConfidence: 0.95,
    senderNameConfidence: 0.90,
    keywordConfidence: 0.75,
    defaultConfidence: 0.30
  },
  phase2: {
    enabled: true,
    delay: 5000, // 5 seconds delay before Phase 2
    batchSize: 20, // Process 20 emails at a time
    concurrency: 5, // Process 5 batches concurrently
    confidenceImprovementThreshold: 0.15, // Only update if 15% better
    maxRetries: 3,
    batchDelayMs: 100 // Delay between batches
  }
}

export default CLASSIFICATION_CONFIG

