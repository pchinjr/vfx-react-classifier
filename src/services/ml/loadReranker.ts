import type { LogisticRerankerModel } from '../../domain/mlModel.ts'

export async function loadLogisticReranker(path: string) {
  const parsed = JSON.parse(await Deno.readTextFile(path)) as unknown

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { modelType?: unknown }).modelType !== 'logistic_regression'
  ) {
    throw new Error(`Unsupported reranker model artifact: ${path}`)
  }

  const model = parsed as LogisticRerankerModel
  if (
    !Array.isArray(model.featureOrder) ||
    !Array.isArray(model.weights) ||
    !Array.isArray(model.means) ||
    !Array.isArray(model.scales) ||
    model.featureOrder.length !== model.weights.length ||
    model.featureOrder.length !== model.means.length ||
    model.featureOrder.length !== model.scales.length
  ) {
    throw new Error(`Invalid reranker model artifact: ${path}`)
  }

  return model
}

export function resolverVersionForModel(
  baseVersion: string,
  model: LogisticRerankerModel,
) {
  return `${baseVersion}+${model.name}@${model.version}`
}
