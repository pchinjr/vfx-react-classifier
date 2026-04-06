import type { CandidateFeatureValues } from './candidateFeatureVector.ts'

export type MlModelRecord = {
  id: string
  name: string
  version: string
  modelType: string
  artifactPath: string
  featureSchemaVersion: string
  metricsJson: string
  createdAt: string
}

export type LogisticRerankerModel = {
  id: string
  name: string
  version: string
  modelType: 'logistic_regression'
  featureSchemaVersion: string
  featureOrder: Array<keyof CandidateFeatureValues>
  weights: number[]
  bias: number
  means: number[]
  scales: number[]
  metrics: RerankerMetrics
  createdAt: string
}

export type RerankerMetrics = {
  rows: number
  spans: number
  accuracy: number
  top1Accuracy: number
  top3Recall: number
  mrr: number
  baselineTop1Accuracy: number
  baselineTop3Recall: number
  baselineMrr: number
}
