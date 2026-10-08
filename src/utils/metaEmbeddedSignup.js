// Meta's real Embedded Signup flow: FB.login (with a WhatsApp Embedded
// Signup config_id) returns an authorization `code`, while a separate
// window `message` event (type: 'WA_EMBEDDED_SIGNUP') reports which WABA +
// phone number the merchant picked inside the popup. Both halves are
// required — the backend re-verifies all of it against the Graph API
// before trusting any of it (server/src/services/whatsapp.service.ts#completeEmbeddedSignup).
const SDK_LOAD_TIMEOUT_MS = 10_000
const FB_MESSAGE_ORIGINS = new Set(['https://www.facebook.com', 'https://web.facebook.com'])

function waitForFbSdk() {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB)
    if (window.__fbSdkReady) return resolve(window.FB)
    const onReady = () => {
      window.removeEventListener('fb-sdk-ready', onReady)
      resolve(window.FB)
    }
    window.addEventListener('fb-sdk-ready', onReady)
    setTimeout(() => {
      window.removeEventListener('fb-sdk-ready', onReady)
      reject(new Error('Meta SDK failed to load — check your network connection and try again.'))
    }, SDK_LOAD_TIMEOUT_MS)
  })
}

let initializedAppId = null

// Matches the server's WHATSAPP_API_VERSION default (server/src/config/env.ts)
// and Meta's current Embedded Signup docs example. v21.0 (the previous value
// here) is still within Meta's supported window, so this was not a functional
// failure — just drifted from both the current docs and the server's own version.
const FB_SDK_VERSION = 'v25.0'

async function ensureInit(appId) {
  const FB = await waitForFbSdk()
  if (initializedAppId !== appId) {
    FB.init({ appId, cookie: true, xfbml: false, version: FB_SDK_VERSION })
    initializedAppId = appId
  }
  return FB
}

/**
 * Runs Meta's real Embedded Signup popup and resolves with the raw
 * {code, wabaId, phoneNumberId, businessId} needed by POST /whatsapp/connect.
 * Throws if the merchant cancels, Meta reports an error, or either half
 * (code / waba+number selection) never arrives.
 */
export async function runEmbeddedSignup({ appId, configId }) {
  const FB = await ensureInit(appId)

  let signupData = null
  let signupError = null

  function onMessage(event) {
    if (!FB_MESSAGE_ORIGINS.has(event.origin)) return
    let data
    try {
      data = JSON.parse(event.data)
    } catch {
      return
    }
    if (data?.type !== 'WA_EMBEDDED_SIGNUP') return
    // Meta's docs: successful completion is FINISH (or a FINISH_* variant);
    // an abandoned flow AND a Meta-side error both arrive as CANCEL — the
    // error case is the one carrying data.error_message.
    if (typeof data.event === 'string' && data.event.startsWith('FINISH')) {
      signupData = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id, businessId: data.data?.business_id }
    } else if (data.event === 'CANCEL') {
      signupError = new Error(
        data.data?.error_message
          ? `Meta reported an error: ${data.data.error_message}${data.data?.error_code ? ` (code ${data.data.error_code})` : ''}`
          : `Connection cancelled${data.data?.current_step ? ` at step: ${data.data.current_step}` : ''}.`,
      )
    } else if (data.event === 'ERROR') {
      signupError = new Error(data.data?.error_message || 'Meta reported an error while connecting this number.')
    }
  }

  window.addEventListener('message', onMessage)

  try {
    const loginResponse = await new Promise((resolve) => {
      // extras: {} matches Meta's current Embedded Signup v4 spec (the
      // "Create from template" Facebook Login for Business configuration we
      // use is itself v4 — selecting products on that template auto-sets
      // v4). sessionInfoVersion was a v2-only parameter ("Partners are
      // required to add a sessionInfoVersion to receive the callback"),
      // removed in v3, and not part of v4's extras at all — sending it here
      // was a stale v2-era value left over in this flow and doesn't match
      // the config we actually use.
      FB.login(resolve, {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      })
    })

    if (signupError) throw signupError

    const code = loginResponse?.authResponse?.code
    if (!code) throw new Error('Meta did not return an authorization code — the connection was not completed.')
    if (signupData?.wabaId && !signupData?.phoneNumberId) {
      throw new Error('Meta connected the business account but no phone number was registered — run the signup again and add a phone number.')
    }
    if (!signupData?.wabaId || !signupData?.phoneNumberId) {
      throw new Error('Meta did not report a connected WhatsApp Business Account — the connection was not completed.')
    }

    return { code, wabaId: signupData.wabaId, phoneNumberId: signupData.phoneNumberId, businessId: signupData.businessId }
  } finally {
    window.removeEventListener('message', onMessage)
  }
}
