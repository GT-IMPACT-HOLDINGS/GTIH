# QuoteMe v1 Testing Guide

## Day-Zero Scenario Testing

### How to Reset to Day-Zero State

The day-zero scenario occurs when a user opens QuoteMe for the first time with an **empty Profile** (`profile === null`). To test this scenario, you need to clear the QuoteMe localStorage data.

#### Method 1: Browser DevTools Console (Recommended)

1. Open QuoteMe in your browser: `http://localhost:8080/gt2/QuoteMe/index.html`
2. Open Browser DevTools (F12 or Right-click → Inspect)
3. Go to the **Console** tab
4. Run this command:
   ```javascript
   localStorage.removeItem('quoteme.v1')
   ```
5. Refresh the page (F5 or Ctrl+R)
6. You should now see the **Landing Page** with the Profile onboarding form

#### Method 2: Browser DevTools Application/Storage Tab

1. Open QuoteMe in your browser
2. Open Browser DevTools (F12)
3. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Navigate to: **Local Storage** → `http://localhost:8080`
5. Find the key `quoteme.v1`
6. Right-click → **Delete** (or click Delete button)
7. Refresh the page
8. You should now see the **Landing Page**

#### Method 3: Clear All Site Data (Nuclear Option)

⚠️ **Warning:** This clears ALL localStorage for the site, not just QuoteMe.

1. Open Browser DevTools
2. Go to **Application** tab → **Storage**
3. Click **Clear site data** or **Clear storage**
4. Refresh the page

---

## Day-Zero Test Scenario Steps

### Expected Flow:

1. **Initial State Check:**
   - Open `http://localhost:8080/gt2/QuoteMe/index.html`
   - Verify: **Landing Page** is displayed (Profile form visible)
   - Verify: Main shell is **not** visible

2. **Profile Form Validation:**
   - Try to submit empty form → Should show validation errors
   - Fill only some required fields → Should block submit
   - Fill all required fields → Submit button should work

3. **Profile Submission:**
   - Fill all required fields:
     - Company Name: "Test Company"
     - Role/Title: "Sales Manager"
     - Industry/Segment: "B2B Software"
     - Geography: "North America"
     - Product/Service Category: "SaaS Platform"
   - Click "Create my QuoteMe workspace"
   - **Expected:** Form submits, Profile saved to localStorage

4. **Post-Submit Behavior (Current Phase 1):**
   - **Expected:** Routes to main shell (Opportunities list view)
   - **Note:** PA generation will be implemented in Phase 2, so PA won't exist yet
   - Verify: Sidebar shows Opportunities, PA, Profile, Admin
   - Verify: Opportunities list is empty (or shows existing opportunities if any)

5. **Verify localStorage:**
   - Open DevTools Console
   - Run: `JSON.parse(localStorage.getItem('quoteme.v1'))`
   - Verify: `profile` object exists with all fields
   - Verify: `pa` is `null` (will be populated in Phase 2)
   - Verify: `opportunities` is an empty array `[]`

---

## Quick Reset Script (Copy-Paste)

For faster testing, you can use this in the browser console:

```javascript
// Reset QuoteMe to day-zero state
localStorage.removeItem('quoteme.v1');
console.log('✅ QuoteMe data cleared. Refresh the page to see landing page.');
location.reload();
```

Or create a bookmarklet (save as bookmark, click to reset):

```javascript
javascript:(function(){localStorage.removeItem('quoteme.v1');location.reload();})();
```

---

## Verification Checklist

After resetting to day-zero:

- [ ] Landing page form is visible
- [ ] Main shell is hidden
- [ ] Form validation works (blocks empty required fields)
- [ ] Profile submission saves to localStorage
- [ ] After submit, main shell appears
- [ ] Sidebar navigation is visible (Opportunities, PA, Profile, Admin)
- [ ] Opportunities list is empty or shows existing items
- [ ] localStorage contains `quoteme.v1` with `profile` object

---

## Current Limitations (Phase 1)

- ✅ Profile onboarding works
- ✅ Profile saves to localStorage
- ✅ Routing to main shell works
- ⏳ PA generation (Phase 2 - not yet implemented)
- ⏳ Profile editing with PA regeneration prompt (Phase 2)

---

*Last updated: Phase 1 implementation*
