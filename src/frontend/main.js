import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import './styles/light.css'
import { currentLang, translations } from './utils/i18n'
import { http } from './utils/http'
import { initConfig, getApiBases, getTitle, getBackgroundImage } from './utils/config'
import { VERSION } from './utils/api'

const getTranslation = () => {
  const lang = localStorage.getItem('language_preference') || 'en'
  return translations[lang] || translations.en
}

const trans = () => getTranslation()

async function fetchConfig() {
  try {
    const results = await http.getAll('/api/config', { includeAuth: false, includeTurnstile: true })
    if (!results || results.length === 0) {
      return { turnstile_enabled: false, turnstile_login_enabled: false, turnstile_site_key: '', version: '', verified: false }
    }

    let turnstileEnabled = false
    let turnstileLoginEnabled = false
    let turnstileSiteKey = ''
    let version = ''
    let verified = false

    for (const { data, error } of results) {
      if (error || !data) continue
      if (data.turnstile_enabled) {
        turnstileEnabled = true
      }
      if (data.turnstile_login_enabled) {
        turnstileLoginEnabled = true
      }
      if (data.turnstile_site_key && !turnstileSiteKey) {
        turnstileSiteKey = data.turnstile_site_key
      }
      if (data.verified) {
        verified = true
      }
      if (data.version && !version) {
        version = data.version
      }
    }

    if (version) {
      VERSION.value = version
    }

    return {
      turnstile_enabled: turnstileEnabled,
      turnstile_login_enabled: turnstileLoginEnabled,
      turnstile_site_key: turnstileSiteKey,
      version,
      verified
    }
  } catch (e) {
    console.error('Failed to fetch config:', e)
  }
  return { turnstile_enabled: false, turnstile_login_enabled: false, turnstile_site_key: '', verified: false }
}

async function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function verifyTurnstile(siteKey) {
  return new Promise((resolve) => {
    turnstile.render('#turnstile-container', {
      sitekey: siteKey,
      callback: async (token) => {
        localStorage.setItem('turnstile_token', token)
        try {
          const result = await http.get('/api/config', { includeAuth: false, includeTurnstile: true, autoRedirect: false })
          if (!result.error) {
            resolve(result.data && result.data.verified === true)
          } else {
            resolve(false)
          }
        } catch (e) {
          console.error('Failed to verify token:', e)
          resolve(false)
        }
      },
      errorCallback: (error) => {
        console.error('Turnstile error:', error)
        resolve(false)
      },
      expiredCallback: () => {
        localStorage.removeItem('turnstile_token')
        resolve(false)
      }
    })
  })
}

const showTurnstileUnsupported = () => {
  const loading = document.getElementById('loading')
  if (loading) {
    loading.innerHTML = `
      <div class="loading-content">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div class="loading-text" style="color: #f85149;">${trans().turnstileNotSupported}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 12px; max-width: 480px; text-align: center; line-height: 1.6;">${trans().turnstileNotSupportedDesc}</div>
      </div>
    `
  }
}

async function initApp() {
  // Load frontend runtime config (apiBase) first so all subsequent
  // HTTP / WebSocket requests go through the configured origin.
  await initConfig()

  const appTitle = getTitle()
  const bgImage = getBackgroundImage()

  if (appTitle) {
    document.title = appTitle
  }

  if (bgImage) {
    document.body.style.backgroundImage = `url(${bgImage})`
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundRepeat = 'no-repeat'
    document.body.style.backgroundAttachment = 'fixed'
  }

  const config = await fetchConfig()

  const isRemoteMode = getApiBases().length > 1

  // 仅全局模式需要在启动时验证 Turnstile；登录模式在 Admin 页面的登录表单中验证
  if (config.turnstile_enabled) {
    if (isRemoteMode) {
      // Remote mode does not support Turnstile - show notice and stop
      showTurnstileUnsupported()
      return
    }

    if (config.turnstile_site_key && !config.verified) {
      const loading = document.getElementById('loading')
      if (loading) {
        loading.innerHTML = `
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">$ Verifying...</div>
            <div id="turnstile-container" style="margin-top: 20px;"></div>
          </div>
        `
      }

      try {
        await loadTurnstileScript()
        const verified = await verifyTurnstile(config.turnstile_site_key)

        if (!verified) {
          loading.innerHTML = `
            <div class="loading-content">
              <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
              <div class="loading-text" style="color: #f85149;">${trans().verificationFailed}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">${trans().refreshToRetry}</div>
            </div>
          `
          return
        }
      } catch (e) {
        console.error('Turnstile error:', e)
        loading.innerHTML = `
          <div class="loading-content">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <div class="loading-text" style="color: #f85149;">${trans().verificationError}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">${trans().refreshToRetry}</div>
          </div>
        `
        return
      }
    }
  }

  const app = createApp(App)
  app.use(router)
  app.mount('#app').$nextTick(() => {
    const loading = document.getElementById('loading')
    if (loading) {
      setTimeout(() => {
        loading.remove()
      }, 1000)
    }
  })
}

initApp()
