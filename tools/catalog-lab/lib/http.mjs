export const RETRY_POLICY = Object.freeze({
  transientRetries: 4,
  rateLimitRetries: 5,
  imageRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
});

export function classifyHttpFailure(status) {
  if (status === 401 || status === 403) return 'SOURCE_PAUSED';
  if (status === 404) return 'SOURCE_NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'FAILED_RETRYABLE';
  return 'FAILED_PERMANENT';
}

function sourceError(code, { status, cause } = {}) {
  const error = new Error(code);
  error.code = code;
  if (status !== undefined) error.status = status;
  if (cause !== undefined) error.cause = cause;
  return error;
}

function retryAfterMilliseconds(response, now) {
  const value = response.headers?.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now());
}

function retryDelay(attempt, { random }) {
  const exponential = Math.min(RETRY_POLICY.maxDelayMs, RETRY_POLICY.baseDelayMs * (2 ** attempt));
  const jitter = Math.floor(random() * RETRY_POLICY.baseDelayMs);
  return Math.min(RETRY_POLICY.maxDelayMs, exponential + jitter);
}

function retryLimit(kind, failure) {
  if (failure === 'RATE_LIMITED') return RETRY_POLICY.rateLimitRetries;
  return kind === 'IMAGE' ? RETRY_POLICY.imageRetries : RETRY_POLICY.transientRetries;
}

export function createHttpClient({
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random = Math.random,
  now = Date.now,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  return Object.freeze({
    async request({ url, kind = 'DATA', ...init }) {
      let attempt = 0;
      while (true) {
        let response;
        let failure;
        let cause;
        try {
          response = await fetchImpl(url, init);
          if (response.ok) return response;
          failure = classifyHttpFailure(response.status);
        } catch (error) {
          failure = 'FAILED_RETRYABLE';
          cause = error;
        }

        if (failure === 'SOURCE_PAUSED' || failure === 'SOURCE_NOT_FOUND' || failure === 'FAILED_PERMANENT') {
          throw sourceError(failure, { status: response?.status, cause });
        }

        const retries = retryLimit(kind, failure);
        if (attempt >= retries) {
          throw sourceError('SOURCE_RETRY_EXHAUSTED', { status: response?.status, cause });
        }

        const delay = failure === 'RATE_LIMITED'
          ? retryAfterMilliseconds(response, now) ?? retryDelay(attempt, { random })
          : retryDelay(attempt, { random });
        await sleep(delay);
        attempt += 1;
      }
    },
  });
}
