# QuoteMe v1 API Key Functionality — Implementation Plan

## Summary
Add GT3 API key management functionality to QuoteMe v1, mirroring Legato's implementation exactly (Settings sidebar opened by clicking logo, API key stored in localStorage, sent in inference headers).

---

## Part 1: Spec Updates

### Spec Update 1: QuoteMeUxSpec.md — Settings Sidebar

**Location:** Add new section after 3.6 "EP.html flow" (or integrate into existing sections)

**Current State:** No Settings/API key UI documented

**Proposed Addition:**
```
3.7 Settings (GT3 API Key Configuration)

Purpose: allow users to enter GT3 API key for inference requests.

Access:
- Click GT2 logo (top-left) to open Settings sidebar (Bootstrap offcanvas)
- Settings sidebar slides in from left

UI:
- Offcanvas sidebar with title "GT3 Settings"
- Password input field labeled "GT3 API Key"
- Helper text: "Key is stored in browser localStorage only."
- "Clear Key" button (outline-danger, small)
- Close button (Bootstrap offcanvas close)

Behavior:
- API key is stored in localStorage under key `quoteme_gt3_api_key` (separate from `quoteme.v1` data blob)
- Key is loaded on page load
- Key is sent in headers `X-GT3-OpenRouter-Key` and `X-GT3-OpenAI-Key` on every inference request (if present)
- Key persists across page reloads
- Key can be cleared via "Clear Key" button

Note: API key is optional but may be required if GT3 server configuration requires it.
```

**Rationale:** Documents the Settings sidebar UI and behavior, matching Legato's pattern.

---

### Spec Update 2: QuoteMeApiSpec.md — API Key Headers (Already Present)

**Location:** Section 2.1 "Optional API Key Headers" (already exists in v1.2)

**Status:** ✅ Already documented

**Note:** The spec already mentions API key headers. May need minor clarification about Settings sidebar access method.

---

### Spec Update 3: QuoteMeSecurityPrivacySpec.md — API Key Storage

**Location:** Add to section 1 "Principles" or new section

**Current State:** Mentions API keys in sensitive categories but doesn't document storage/management

**Proposed Addition:**
```
## 8) API Key Management (v1)

### 8.1 Storage
- API key is stored in browser localStorage under key `quoteme_gt3_api_key`
- Separate from main QuoteMe data blob (`quoteme.v1`)
- Stored as plain text (not encrypted)
- Persists across browser sessions

### 8.2 Access
- Accessible via Settings sidebar (click GT2 logo)
- Password input field (type="password" for visual masking)
- User can enter, edit, or clear API key at any time

### 8.3 Usage
- API key is sent in request headers if present:
  - `X-GT3-OpenRouter-Key` (if key exists)
  - `X-GT3-OpenAI-Key` (if key exists)
- GT3 server uses the relevant header per provider configuration
- Key is not logged in audit payloads (security best practice)

### 8.4 Security Note
- API key storage is local-only (browser localStorage)
- No server-side persistence
- Key is sent over network in HTTP headers (HTTPS recommended for production)
- v1 does not encrypt the key in localStorage
```

**Rationale:** Documents API key storage, access, and security considerations.

---

## Part 2: Implementation

### Implementation Step 1: Update gt3-client.js

**File:** `gt3-client.js`

**Changes:**
1. Add API key storage constants:
   ```javascript
   const API_KEY_STORAGE_KEY = 'quoteme_gt3_api_key';
   let gt3ApiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || '';
   ```

2. Add API key getter/setter functions:
   ```javascript
   function getApiKey() {
     return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
   }
   
   function setApiKey(key) {
     if (key && key.trim()) {
       localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
       gt3ApiKey = key.trim();
     } else {
       localStorage.removeItem(API_KEY_STORAGE_KEY);
       gt3ApiKey = '';
     }
   }
   ```

3. Update `buildInferenceHeaders()` to include API key headers:
   ```javascript
   function buildInferenceHeaders() {
     const headers = {
       'Content-Type': 'application/json',
       'X-GT3-Tenant': 'gt2-quoteme-dev',
       'X-GT3-Data-Track': 'green',
       'X-GT3-Consent-Version': 'v1'
     };

     if (gt3ApiKey) {
       // Send the same key in both headers (per Legato pattern)
       // GT3 will use the relevant one per provider and ignore the rest
       headers['X-GT3-OpenRouter-Key'] = gt3ApiKey;
       headers['X-GT3-OpenAI-Key'] = gt3ApiKey;
     }

     return headers;
   }
   ```

4. Initialize API key on module load:
   ```javascript
   // Load API key on module initialization
   gt3ApiKey = getApiKey();
   ```

5. Export new functions:
   ```javascript
   export { callGT3, getInferenceUri, getApiKey, setApiKey };
   ```

**Validation:**
- Manual: Enter API key in Settings, verify it's sent in inference request headers (check browser DevTools Network tab)

---

### Implementation Step 2: Add Settings Sidebar to index.html

**File:** `index.html`

**Changes:**
1. Add Settings offcanvas sidebar (after main shell, before Bootstrap JS):
   ```html
   <!-- Settings Sidebar (Offcanvas) -->
   <div
     class="offcanvas offcanvas-start"
     tabindex="-1"
     id="settings-offcanvas"
     aria-labelledby="settings-offcanvas-label"
   >
     <div class="offcanvas-header">
       <h5 class="offcanvas-title" id="settings-offcanvas-label">GT3 Settings</h5>
       <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
     </div>
     <div class="offcanvas-body small">
       <p class="mb-2 text-muted">
         Enter your GT3 API key here. The key is stored in browser localStorage only
         and sent with every inference request to GT3.
       </p>

       <div class="mb-3">
         <label for="settings-api-key" class="form-label">GT3 API Key</label>
         <input
           type="password"
           id="settings-api-key"
           class="form-control form-control-sm"
           placeholder="Paste your API key here"
         />
         <div class="form-text">
           Key is stored in browser localStorage only.
         </div>
       </div>

       <div class="d-flex gap-2">
       <button type="button" id="settings-api-clear" class="btn btn-outline-danger btn-sm">
         Clear Key
       </button>
       </div>
     </div>
   </div>
   ```

2. Make GT2 logo clickable (add id and cursor style):
   ```html
   <img src="../gt2-logo-small.png" alt="GT2 logo" class="gt2-logo" id="gt2-logo" style="height: 28px; cursor: pointer;">
   ```

3. Add Settings panel initialization function:
   ```javascript
   // Settings sidebar (API key)
   function initSettingsPanel() {
     const apiInput = document.getElementById('settings-api-key');
     const clearBtn = document.getElementById('settings-api-clear');

     if (!apiInput) return;

     // Load existing key
     apiInput.value = getApiKey();

     // Save on input
     apiInput.addEventListener('input', () => {
       setApiKey(apiInput.value.trim());
     });

     // Clear button
     clearBtn?.addEventListener('click', () => {
       setApiKey('');
       apiInput.value = '';
     });
   }

   // Logo click → open settings sidebar
   const logoEl = document.getElementById('gt2-logo');
   if (logoEl) {
     logoEl.addEventListener('click', () => {
       const offcanvasEl = document.getElementById('settings-offcanvas');
       if (!offcanvasEl || typeof bootstrap === 'undefined') return;
       const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
       offcanvas.show();
     });
   }
   ```

4. Call `initSettingsPanel()` in initialization section

5. Import `getApiKey` and `setApiKey` from `gt3-client.js`:
   ```javascript
   import { callGT3, getApiKey, setApiKey } from './gt3-client.js';
   ```

**Validation:**
- Manual: Click GT2 logo, verify Settings sidebar opens
- Enter API key, verify it persists after page reload
- Clear API key, verify it's removed

---

### Implementation Step 3: Add Settings Sidebar to pa.html

**File:** `pa.html`

**Changes:**
1. Add same Settings offcanvas sidebar (copy from index.html)
2. Make GT2 logo clickable (add id and cursor style)
3. Add same `initSettingsPanel()` function and logo click handler
4. Import `getApiKey` and `setApiKey` from `gt3-client.js`

**Rationale:** PA page also makes GT3 calls (regenerate PA), so Settings should be accessible there too.

**Validation:**
- Manual: Click logo on PA page, verify Settings sidebar opens
- Enter API key, verify it's shared with index.html (same localStorage key)

---

### Implementation Step 4: Add Settings Sidebar to opportunity.html (Future)

**File:** `opportunity.html` (to be created in Phase 3)

**Note:** When implementing opportunity.html in Phase 3, include the same Settings sidebar pattern.

---

## Implementation Summary

### Files to Modify:
1. ✅ `gt3-client.js` — Add API key storage, getter/setter, header injection
2. ✅ `index.html` — Add Settings sidebar, logo click handler, init function
3. ✅ `pa.html` — Add Settings sidebar, logo click handler, init function
4. ⏳ `opportunity.html` — Add Settings sidebar (Phase 3)

### Specs to Update:
1. ✅ `QuoteMeUxSpec.md` — Add section 3.7 "Settings (GT3 API Key Configuration)"
2. ✅ `QuoteMeSecurityPrivacySpec.md` — Add section 8 "API Key Management"
3. ✅ `QuoteMeApiSpec.md` — Already has API key headers documented (v1.2), may need minor clarification

### Key Implementation Details (Matching Legato):
- **Storage key:** `quoteme_gt3_api_key` (separate from `quoteme.v1`)
- **UI:** Bootstrap offcanvas sidebar (left side)
- **Access:** Click GT2 logo
- **Headers:** `X-GT3-OpenRouter-Key` and `X-GT3-OpenAI-Key` (both set to same value if key exists)
- **Persistence:** localStorage, persists across sessions
- **Language:** English (not Hebrew like Legato)
- **Colors:** QuoteMe color scheme (#2F6BFF primary, #00B8D9 approved)

---

## Validation Checklist

- [ ] Click GT2 logo on index.html → Settings sidebar opens
- [ ] Enter API key in Settings → key persists after page reload
- [ ] Clear API key → key is removed from localStorage
- [ ] With API key set → inference requests include `X-GT3-OpenRouter-Key` and `X-GT3-OpenAI-Key` headers
- [ ] Without API key → inference requests work (if GT3 doesn't require it) or fail gracefully
- [ ] Settings accessible from pa.html (same functionality)
- [ ] API key shared across all QuoteMe pages (same localStorage key)

---

*Generated: 2025-01-XX (by GTL2)*
