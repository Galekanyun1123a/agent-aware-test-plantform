/**
 * HTTP 请求工具
 */

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  ok: boolean;
}

/**
 * 发送 HTTP 请求
 */
export async function httpRequest(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse> {
  const { method = 'GET', headers = {}, body, timeout = 5000 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    };

    if (body !== undefined && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    let responseBody: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }
    } else {
      responseBody = await response.text();
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      ok: response.ok,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 等待端口可用
 */
export async function waitForPort(
  port: number,
  host = '127.0.0.1',
  timeout = 30000,
  interval = 500
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await httpRequest(`http://${host}:${port}`, {
        method: 'GET',
        timeout: 1000,
      });
      if (response.status > 0) {
        return true;
      }
    } catch {
      // 端口还未可用，继续等待
    }
    await sleep(interval);
  }

  return false;
}

/**
 * 检查端口是否可用
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    await httpRequest(`http://127.0.0.1:${port}`, {
      method: 'GET',
      timeout: 1000,
    });
    return false; // 端口被占用
  } catch {
    return true; // 端口可用
  }
}

/**
 * 延迟
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 发送测试数据到端点
 */
export async function sendTestData(
  endpoint: string,
  data: object[]
): Promise<HttpResponse[]> {
  const responses: HttpResponse[] = [];

  for (const item of data) {
    const response = await httpRequest(endpoint, {
      method: 'POST',
      body: item,
    });
    responses.push(response);
  }

  return responses;
}
