// Search is retrieval-first, so cosine similarity is the only ranking signal
// used once embeddings have been generated.
export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length) {
    throw new Error('Embedding vectors must have the same dimensions')
  }

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] * left[index]
    rightMagnitude += right[index] * right[index]
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}
