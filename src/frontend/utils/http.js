const API_BASE = window.location.origin

const DEFAULT_ERROR_MESSAGES = {
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error'
}

const createHeaders = (includeAuth = true, includeTurnstile = true) => {
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
  }
  
  return headers
}

const handleResponse = async (res, options = {}) => {
  const { autoRedirect = true } = options
  
  if (res.status === 401) {
    localStorage.removeItem('jwt_token')
    if (autoRedirect) {
      window.location.href = '/admin'
    }
    return { error: DEFAULT_ERROR_MESSAGES[401], status: 401 }
  }
  
  if (res.status === 403) {
    localStorage.removeItem('turnstile_token')
    if (autoRedirect) {
      window.location.reload()
    }
    return { error: DEFAULT_ERROR_MESSAGES[403], status: 403 }
  }
  
  if (!res.ok) {
    let errorMessage = DEFAULT_ERROR_MESSAGES[res.status] || 'Request failed'
    let errorCode = res.status
    try {
      const data = await res.json()
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
    return { error: errorMessage, code: errorCode, status: res.status }
  }
  
  try {
    const data = await res.json()
    return { data, status: res.status }
  } catch (e) {
    return { data: null, status: res.status }
  }
}

export const http = {
  async get(url, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true } = options
    const headers = createHeaders(includeAuth, includeTurnstile)
    
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'GET',
      headers
    })
    
    return handleResponse(res, { autoRedirect })
  },
  
  async post(url, body = {}, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true } = options
    const headers = createHeaders(includeAuth, includeTurnstile)
    
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    
    return handleResponse(res, { autoRedirect })
  },
  
  async put(url, body = {}, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true } = options
    const headers = createHeaders(includeAuth, includeTurnstile)
    
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    })
    
    return handleResponse(res, { autoRedirect })
  },
  
  async delete(url, options = {}) {
    const { includeAuth = true, includeTurnstile = true, autoRedirect = true } = options
    const headers = createHeaders(includeAuth, includeTurnstile)
    
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'DELETE',
      headers
    })
    
    return handleResponse(res, { autoRedirect })
  }
}

export const isAdminLoggedIn = () => {
  return !!localStorage.getItem('jwt_token')
}

export default http