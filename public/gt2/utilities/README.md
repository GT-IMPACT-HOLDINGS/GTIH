# GT2 Utilities

Reusable components and utilities for GT2 vertical applications (Legato, QuoteMe, etc.).

## draft-field.js

A reusable component for inline-editable GT3 outputs with glyph-based approval, compliant with `GT2_DraftFirst_MicroUX_Spec.md`.

### Usage

```javascript
import { createDraftField, updateDraftField } from '../utilities/draft-field.js';

// Create a draft field
const container = createDraftField({
  label: 'Proposal Anatomy (PA)',
  text: pa.text || '',
  approved: pa.paApproved || false,
  hasLmDraft: pa.hasLmDraft || false,
  hasUserEdits: pa.hasUserEdits || false,
  readOnly: false,
  placeholder: 'Enter text...',
  onTextChange: (newText, userHasEdited) => {
    // Handle text changes (auto-save, etc.)
  },
  onApproveToggle: (isApproved) => {
    // Handle approval toggle
  },
  onRegenerate: () => {
    // Optional: Handle regeneration from GT3
  }
});

// Append to DOM
document.getElementById('container').appendChild(container);

// Update field (e.g., after regeneration)
updateDraftField(container, {
  text: newText,
  approved: false,
  hasLmDraft: true,
  hasUserEdits: false
});
```

### Features

- **5-state glyph system**: Empty / User-only (●) / LM-only (◯) / LM+User (◉) / Approved (◯✓)
- **Glyph-based approval**: Click glyph to toggle approval (with tooltips)
- **Auto-revoke on edit**: Editing an approved field automatically revokes approval
- **Inline editing**: Always editable (unless lifecycle-locked)
- **Accessibility**: ARIA labels and keyboard support

### Compliance

This component implements the GT2 Draft-First UX pattern:
- ✅ Inline editable textarea
- ✅ Draft by default
- ✅ Glyph toggle for approval (not button)
- ✅ Required tooltips ("Click to approve" / "Approved — click to unapprove")
- ✅ Auto-revoke approval on edit
- ✅ Read-only only when lifecycle-justified
