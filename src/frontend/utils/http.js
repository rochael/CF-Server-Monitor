import { getApiBases } from './config'

const DEFAULT_ERROR_MESSAGES = {
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error'
}

const TURNSTILE_KEY_PREFIX = 'turnstile_verified:'

const getTurnstileVerifiedKey = (baseUrl) => {
  return TURNSTILE_KEY_PREFIX + (baseUrl || getApiBases()[0])
}

const createHeaders = (includeAuth = true, includeTurnstile = true, baseUrl = null) => {
  const headers = {
    'Content-Type': 'application/json'
  }
  
  if (includeAuth) {
    const token = localStorage.getItem('jwt_token')
    if (token) {
      headers['Authorization'] = 'Bearer ' + token
    }
  }
  
  if (includeTurnstile) {
    const turnstileToken = localStorage.getItem('turnstile_token')
    if (turnstileToken) {
      headers['X-Turnstile-Token'] = turnstileToken
    }
    const key = getTurnstileVerifiedKey(baseUrl)
    const turnstileVerified = localStorage.getItem(key)
    if (turnstileVerified) {
      headers['X-Turnstile-Verified'] = turnstileVerified
    }
  }
  
  return headers
}

const handleResponse = async (res, options = {}) => {
  const { autoRedirect = true, baseUrl = null } = options
  
  if (res.status === 401) {
    localStorage.removeItem('jwt_token')
    if (autoRedirect) {
      window.location.hash = '#/admin'
    }
    return { error: DEFAULT_ERROR_MESSAGES[401], status: 401 }
  }
  
  if (res.status === 403) {
    localStorage.removeItem('turnstile_token')
    localStorage.removeItem('turnstile_verified')
    try {
      const key = getTurnstileVerifiedKey(baseUrl)
      localStorage.removeItem(key)
    } catch (_) {}
    if (autoRedirect) {
      window.location.reload()
    }
    return { error: DEFAULT_ERROR_MESSAGES[403], status: 403 }
  }
  
  if (!res.ok) {
    let errorMessage = DEFAULT_ERROR_MESSAGES[res.status] || 'Request failed'
    let errorCode = res.status
    let errorMessageKey = null
    try {
      const data = await res.json()
      if (data.message) {
        errorMessageKey = data.message
      }
      if (data.error) {
        errorMessage = data.error
      }
      if (data.code) {
        errorCode = data.code
        if (!data.error && typeof data.code === 'string') {
          errorMessage = data.code
        }
      }
    } catch (e) {
      // ignore
    }
    return { error: errorMessage, code: errorCode, status: res.status, message: errorMessageKey }
  }
  
  try {
    const data = await res.json()
    if (data && data.turnstile_verified) {
      const key = getTurnstileVerifiedKey(baseUrl)
      localStorage.setItem(key, data.turnstile_verified)
      localStorage.removeItem('turnstile_token')
    }
    return { data, status: res.status }
  } catch (e) {
    return { data: null, status: res.status }
  }
}

const fetchWithBase = async (baseUrl, url, options, method = 'GET', body = null) => {
  const { includeAuth = true, includeTurnstile = true, autoRedirect = true } = options
  const headers = createHeaders(includeAuth, includeTurnstile, baseUrl)

  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers,
    body,
    credentials: 'include'
  })

  const result = await handleResponse(res, { autoRedirect, baseUrl })
  return { ...result, baseUrl }
}

export const http = {
  async get(url, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true, baseUrl = null } = options
    const headers = createHeaders(includeAuth, includeTurnstile, baseUrl)
    const base = baseUrl || getApiBases()[0]

    const res = await fetch(`${base}${url}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    })

    return handleResponse(res, { autoRedirect, baseUrl: base })
  },

  async post(url, body = {}, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true, baseUrl = null } = options
    const headers = createHeaders(includeAuth, includeTurnstile, baseUrl)
    const base = baseUrl || getApiBases()[0]

    const res = await fetch(`${base}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include'
    })

    return handleResponse(res, { autoRedirect, baseUrl: base })
  },

  async put(url, body = {}, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true, baseUrl = null } = options
    const headers = createHeaders(includeAuth, includeTurnstile, baseUrl)
    const base = baseUrl || getApiBases()[0]

    const res = await fetch(`${base}${url}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      credentials: 'include'
    })

    return handleResponse(res, { autoRedirect, baseUrl: base })
  },

  async delete(url, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true, baseUrl = null } = options
    const headers = createHeaders(includeAuth, includeTurnstile, baseUrl)
    const base = baseUrl || getApiBases()[0]

    const res = await fetch(`${base}${url}`, {
      method: 'DELETE',
      headers,
      credentials: 'include'
    })

    return handleResponse(res, { autoRedirect, baseUrl: base })
  },

  async getAll(url, options = {}) {
    const bases = getApiBases()
    if (bases.length === 0) {
      const result = await this.get(url, options)
      return [{ ...result, baseUrl: getApiBases()[0] }]
    }

    const promises = bases.map(baseUrl => 
      fetchWithBase(baseUrl, url, options, 'GET', null)
    )

    const results = await Promise.all(promises)
    return results
  },

  async postAll(url, body = {}, options = {}) {
    const bases = getApiBases()
    if (bases.length === 0) {
      const result = await this.post(url, body, options)
      return [{ ...result, baseUrl: getApiBases()[0] }]
    }

    const promises = bases.map(baseUrl => 
      fetchWithBase(baseUrl, url, options, 'POST', JSON.stringify(body))
    )

    const results = await Promise.all(promises)
    return results
  },

  async getByIndex(url, index = 0, options = {}) {
    const bases = getApiBases()
    let baseUrl
    if (bases.length > 0 && bases[index] !== undefined) {
      baseUrl = bases[index]
    } else {
      baseUrl = getApiBases()[0]
    }
    return this.get(url, { ...options, baseUrl })
  },

  async postByIndex(url, body = {}, index = 0, options = {}) {
    const bases = getApiBases()
    let baseUrl
    if (bases.length > 0 && bases[index] !== undefined) {
      baseUrl = bases[index]
    } else {
      baseUrl = getApiBases()[0]
    }
    return this.post(url, body, { ...options, baseUrl })
  }
}

export const isAdminLoggedIn = () => {
  return !!localStorage.getItem('jwt_token')
}

export default http
