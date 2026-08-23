# ODD Graphics — customer outcome (v1.1)

---

## Outcome (anchor)

As an ODD user, after each successful **textual** advisor inference, I receive a **watercolor image** that visualizes the inferred output I just read.

Success means: one Enter submit produces **plain-text** advisor output **and** a **128×128 colorful** watercolor-style image derived from that output, shown in **inferred visual**.

---

## Mechanism

1. **First** `POST /inference` — ODD advisor turn (`narrative` + `system`, header `X-GT3-ODD-Direct: 1`).
2. **Second** `POST /inference` — graphics turn:
   - `narrative`: the full textual `response` from step 1 (the ODD output to visualize).
   - `system`: co-located [ODD_Graphics_Image_System_Prompt.md](ODD_Graphics_Image_System_Prompt.md) (body after first `\n---\n`) — asks for **one watercolor image** of that narrative, without further graphical constraints.
   - Header `X-GT3-ODD-Graphics: 1` so GT3 calls OpenRouter image generation with default model **`bytedance-seed/seedream-4.5`** (`modalities: ["image"]`).

The SPA receives **PNG base64** from GT3 (displayed at **128×128**). If generation fails, a **client-generated** 128×128 watercolor fallback is used.

---

## Non-goals (v1 graphics)

- A separate public image URL host beyond OpenRouter’s inline base64 response.
- Persisting images server-side.
- Blocking the textual result if graphics fail.

---

## Responsibility

- The user triggers both steps with one submit; the SPA sequences them.
- The user judges whether the visual matches the text; adoption remains human.

---

## References

- [ODD_Advisor_Product_Spec.md](ODD_Advisor_Product_Spec.md) — integrated behavioral requirements (B9+).
- [ODD_Graphics_Image_System_Prompt.md](ODD_Graphics_Image_System_Prompt.md) — graphics LM instructions.
