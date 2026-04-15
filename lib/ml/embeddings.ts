/**
 * lib/ml/embeddings.ts
 *
 * Local embedding model using @xenova/transformers (all-MiniLM-L6-v2).
 * Runs entirely in-process, no API calls, no per-request cost, no network dependency.
 *
 * Model: sentence-transformers/all-MiniLM-L6-v2
 *   - 384-dimensional embeddings
 *   - ~90MB download, cached to node_modules/.cache/huggingface after first run
 *   - Sufficient quality for 15-topic classification via cosine similarity
 *
 * Interface is identical to the previous OpenAI wrapper so all callers
 * (topic-classifier.ts) work unchanged.
 */

import crypto from "crypto";

// ── Model loader ───────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _localEmbedder: unknown | undefined;
  // eslint-disable-next-line no-var
  var _embeddingCache: Map<string, number[]> | undefined;
}

const embeddingCache: Map<string, number[]> =
  globalThis._embeddingCache ?? (globalThis._embeddingCache = new Map());

let _pipelinePromise: Promise<unknown> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEmbedder(): Promise<any> {
  if (globalThis._localEmbedder) return globalThis._localEmbedder;

  if (!_pipelinePromise) {
    _pipelinePromise = (async () => {
      // Dynamic import so Next.js doesn't try to bundle the ONNX runtime at build time
      const { pipeline } = await import("@xenova/transformers");
      const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        progress_callback: process.env.NODE_ENV === "development"
          ? (p: unknown) => {
              const progress = p as { status?: string; file?: string; progress?: number };
              if (progress.status === "downloading") {
                process.stdout.write(`\r[embedder] downloading ${progress.file ?? ""} ${Math.round(progress.progress ?? 0)}%`);
              }
            }
          : undefined,
      });
      globalThis._localEmbedder = embedder;
      return embedder;
    })();
  }

  return _pipelinePromise;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 24);
}

// ── Public API (same shape as the previous OpenAI wrapper) ─────────────────────

/**
 * Embed multiple texts using the local model.
 * Texts already in cache are returned immediately without model inference.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const toEmbed: { index: number; text: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const key = hashText(texts[i]);
    if (embeddingCache.has(key)) {
      results[i] = embeddingCache.get(key)!;
    } else {
      toEmbed.push({ index: i, text: texts[i] });
    }
  }

  if (toEmbed.length > 0) {
    const embedder = await getEmbedder();

    for (const { index, text } of toEmbed) {
      // @xenova/transformers returns { data: Float32Array, dims: number[] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = await (embedder as any)(
        text.slice(0, 512), // MiniLM max context
        { pooling: "mean", normalize: true }
      ) as { data: Float32Array; dims: number[] };

      // output.data is already mean-pooled and normalized when pooling:"mean" is set
      const vec = Array.from(output.data) as number[];
      const key = hashText(text);
      embeddingCache.set(key, vec);
      results[index] = vec;
    }
  }

  return results as number[][];
}

/** Embed a single text. */
export async function getEmbedding(text: string): Promise<number[]> {
  return (await getEmbeddings([text]))[0];
}

/**
 * Cosine similarity between two vectors, range [-1, 1].
 * For normalized embeddings this is equivalent to dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
