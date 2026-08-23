// =============================================================
// Lexiom i18n — Panel titles and UI strings
// Step 2: Multilingual Lexiom (panel titles, static UI)
// Reads navigator.language / navigator.languages
// =============================================================

(function () {
  "use strict";

  const STRINGS = {
    en: {
      stage: "STAGE",
      shared: "SHARED",
      private: "PRIVATE",
      proposed: "PROPOSED",
      actions: "ACTIONS",
      center_idle: "CENTER IDLE — SELECT AN ACTIVITY TO BEGIN.",
      lexiom_case: "LEXIOM CASE",
      topic_n: "TOPIC",
      gt3_error_prefix: "GT3 Error:",
      no_messages: "No messages yet. Type below to start.",
      typing: "Lexiom: …",
      type_message_placeholder: "Type a message…",
      send: "SEND",
      solo_mode: "/ SOLO MODE",
      artifact: "Artifact",
      artifact_share_copy_link: "Copy link to this artifact",
      shared_document_draft: "Shared document",
      move_n: "MOVE",
      action_item_conv: "Action Item Conversation",
      case_identity: "CASE IDENTITY",
      document_draft: "DOCUMENT DRAFT",
      draft: "DRAFT",
      new_case_hint:
        "Type the initial case narrative here and approve it, or upload a seed .md file into the case directory and refresh.",
      l23_unlock_story: "Unlock Story",
      l23_unlock_intent: "Unlock Intent",
      l23_unlock_path: "Unlock Path",
      l23_unlock_accord: "Unlock Accord",
      l24_disputes_hint: "Review the wording, edit, then click the ring ->",
      l24_tensions_hint: "Review the tensions text, edit if needed, then click the ring to approve ->",
      l24_goals_hint: "Caress the phrase, tap the ring, let meaning slip through ->",
      l24_strategy_hint: "Tap the ring, follow where the subtext leads...",
      l24_undisputed_hint: "Psss.., the ring.., we both know what that means ♥",
      choose_next_move_title: "CHOOSE YOUR NEXT MOVE",
      // Landing / first-entry (aligned with cockpit locale detection)
      landing_page_title: "Lexiom Entry",
      landing_welcome_title: "WELCOME TO LEXIOM",
      landing_btn_new: "I am new to Lexiom",
      landing_btn_returning: "I am returning",
      landing_step1_heading: "Select your role",
      landing_step1_copy: "Pick exactly one role card.",
      landing_role_lawyer: "Lawyer",
      landing_role_mediator: "Mediator",
      landing_role_sales: "Sales Professional",
      landing_role_nonpro: "Non-Professional",
      landing_continue: "Continue",
      landing_back: "Back",
      landing_step2_heading: "Your strategic value proposition",
      landing_value_label:
        "How do you see your unique strategic value proposition in your professional world?",
      landing_step3_heading: "Draft identity statement",
      landing_step3_copy:
        "Lexiom suggests a short profile statement. You may edit freely, then continue.",
      landing_step4_heading: "Outbound draft voice",
      landing_approve_profile: "Approve profile",
      landing_begin_zenith: "Begin in Zenith",
      landing_err_value_proposition: "Please describe your strategic value proposition before continuing.",
      landing_err_draft_empty: "Draft identity statement cannot be empty.",
      landing_err_gt3_required: "Could not generate draft from GT3 right now. Please retry.",
      landing_err_approve_profile_first: "Please approve your profile before selecting a mode.",
      landing_progress_0: "New or returning",
      landing_progress_1: "Select your role",
      landing_progress_2: "Strategic value proposition",
      landing_progress_3: "Draft identity statement",
      landing_progress_4: "Outbound draft voice",
      landing_progress_5: "Welcome & mode selection",
      // Case-create
      case_create_page_title: "Lexiom — New case",
      case_create_main_title: "CREATE A CASE",
      case_create_intro:
        "Frame the matter or point to a folder.",
      case_create_step1_heading: "What is this case about?",
      case_create_choose_folder: "Choose folder",
      case_create_folder_name: "Folder name:",
      case_create_files_list_label: "Files:",
      case_create_file_row: "{name}",
      case_create_file_list_more: "... and {count} more file(s)",
      case_create_fs_warning:
        "Folder pick requires a Chromium-based browser (e.g. Chrome or Edge). You can continue with your text answer only.",
      case_create_enter_cabinet: "Enter",
      case_create_working: "Working…",
      case_create_status_linked:
        "Folder linked — {count} supported file(s) will be used.",
      case_create_status_selected:
        "Folder selected — supported files in this folder and its subfolders will be read when you enter.",
      case_create_error_storage:
        "Could not store case handoff (storage full). Try a smaller folder or shorter answer.",
      case_create_error_folder_read:
        "Could not read the folder. You can still continue with text only.",
      case_create_folder_unknown: "(unknown)",
    },
    he: {
      stage: "שלב",
      shared: "משותף",
      private: "פרטי",
      proposed: "מוצע",
      actions: "פעולות",
      center_idle: "מרכז ריק — בחר פעילות כדי להתחיל.",
      lexiom_case: "מקרה לקסיום",
      topic_n: "נושא",
      gt3_error_prefix: "שגיאת GT3:",
      no_messages: "אין הודעות עדיין. הקלד למטה כדי להתחיל.",
      typing: "Lexiom: …",
      type_message_placeholder: "הקלד הודעה…",
      send: "שלח",
      solo_mode: "/ מצב יחיד",
      artifact: "מסמך",
      artifact_share_copy_link: "העתק קישור למסמך זה",
      shared_document_draft: "מסמך משותף",
      move_n: "מהלך",
      action_item_conv: "שיחת פריט פעולה",
      case_identity: "זהות מקרה",
      document_draft: "טיוטת מסמך",
      draft: "טיוטה",
      new_case_hint:
        "הקלד כאן את נרטיב המקרה הראשוני ואשר אותו, או העלה קובץ .md עם תיאור המקרה לתיקייה ולאחר מכן רענן את המסך.",
      l23_unlock_story: "פתח סיפור",
      l23_unlock_intent: "פתח כוונה",
      l23_unlock_path: "פתח נתיב",
      l23_unlock_accord: "פתח הסכמה",
      l24_disputes_hint: "עיין בניסוח, ערוך, ואז לחץ על הטבעת ->",
      l24_tensions_hint: "עיין בטקסט המתאר את נקודות החיכוך, ערוך במידת הצורך, ואז לחץ על הטבעת כדי לאשר ->",
      l24_goals_hint: "לטף את הביטוי, הקש על הטבעת, ותן למשמעות להחליק ->",
      l24_strategy_hint: "הקש על הטבעת, עקוב לאן שמרמז הסאב-טקסט...",
      l24_undisputed_hint: "פשש.., הטבעת.., שנינו יודעים מה זה אומר ♥",
      choose_next_move_title: "בחר את המהלך הבא",
      landing_page_title: "כניסה ללקסיום",
      landing_welcome_title: "ברוכים הבאים ללקסיום",
      landing_btn_new: "חדשים בלקסיום",
      landing_btn_returning: "חוזרים",
      landing_step1_heading: "בחירת תפקיד",
      landing_step1_copy: "בחרו כרטיס תפקיד אחד בלבד.",
      landing_role_lawyer: "עורך דין",
      landing_role_mediator: "מגשר",
      landing_role_sales: "איש מכירות",
      landing_role_nonpro: "לא מקצוען",
      landing_continue: "המשך",
      landing_back: "חזרה",
      landing_step2_heading: "ערך אסטרטגי ייחודי",
      landing_value_label: "איך אתם רואים את ערך האסטרטגיה הייחודי שלכם בעולם המקצועי?",
      landing_step3_heading: "טיוטת זהות",
      landing_step3_copy: "לקסיום מציע משפט זהות קצר. ניתן לערוך ואז להמשיך.",
      landing_step4_heading: "קול טיוטה כלפי חוץ",
      landing_approve_profile: "אשר פרופיל",
      landing_begin_zenith: "התחלה ב-Zenith",
      landing_err_value_proposition: "נא לתאר את ערך האסטרטגיה לפני המשך.",
      landing_err_draft_empty: "טיוטת הזהות לא יכולה להיות ריקה.",
      landing_err_gt3_required: "לא ניתן להפיק טיוטה מ-GT3 כרגע. נא לנסות שוב.",
      landing_err_approve_profile_first: "נא לאשר את הפרופיל לפני בחירת מצב.",
      landing_progress_0: "חדש או חוזר",
      landing_progress_1: "בחירת תפקיד",
      landing_progress_2: "ערך אסטרטגי",
      landing_progress_3: "טיוטת זהות",
      landing_progress_4: "קול טיוטה כלפי חוץ",
      landing_progress_5: "ברוכים הבאים ובחירת מצב",
      case_create_page_title: "לקסיום — מקרה חדש",
      case_create_main_title: "יצירת מקרה",
      case_create_intro:
        "מסגרו את העניין או ציינו תיקייה.",
      case_create_step1_heading: "תיאור המקרה",
      case_create_choose_folder: "בחירת תיקייה",
      case_create_folder_name: "שם תיקייה:",
      case_create_files_list_label: "קבצים:",
      case_create_file_row: "{name}",
      case_create_file_list_more: "... ועוד {count} קבצים",
      case_create_fs_warning:
        "בחירת תיקייה זמינה בדפדפן מבוסס Chromium (כגון Chrome או Edge). ניתן להמשיך רק עם טקסט.",
      case_create_enter_cabinet: "כניסה",
      case_create_working: "מעבד…",
      case_create_status_linked:
        "התיקייה קושרה — ייעשה שימוש ב-{count} קבצים נתמכים.",
      case_create_status_selected:
        "התיקייה נבחרה — קבצים נתמכים בתיקייה זו ובתיקיות המשנה שלה ייקראו בעת הכניסה.",
      case_create_error_storage:
        "לא ניתן לשמור את העברת המקרה (האחסון מלא). נסו תיקייה קטנה יותר או טקסט קצר יותר.",
      case_create_error_folder_read:
        "לא ניתן לקרוא את התיקייה. אפשר להמשיך עם הטקסט בלבד.",
      case_create_folder_unknown: "(לא ידוע)",
    },
  };

  /** Locales that use right-to-left text and layout. */
  const RTL_LOCALES = ["he", "ar", "fa", "ur"];

  /**
   * Get preferred locale (BCP 47 primary: en, he, etc.).
   * @returns {string}
   */
  function getLocale() {
    const raw = navigator.language || (navigator.languages && navigator.languages[0]) || "en";
    return String(raw).split("-")[0];
  }

  /**
   * Get text/layout direction for the current locale.
   * @returns {"ltr"|"rtl"}
   */
  function getDirection() {
    const loc = getLocale();
    return RTL_LOCALES.indexOf(loc) >= 0 ? "rtl" : "ltr";
  }

  let locale = getLocale();

  /**
   * Translate a key. Falls back to English if locale or key is missing.
   * @param {string} key - i18n key (e.g. "stage", "proposed")
   * @returns {string}
   */
  function t(key) {
    const map = STRINGS[locale] || STRINGS.en;
    const val = map[key];
    if (val !== undefined) return val;
    return (STRINGS.en && STRINGS.en[key]) || key;
  }

  /**
   * Apply translations to all elements with data-i18n attribute,
   * and set layout/text direction on the cabinet so left panel, center,
   * and right panel follow the chosen language (RTL e.g. Hebrew, LTR e.g. English).
   * Call once after DOM is ready (e.g. at app init).
   */
  function applyI18n() {
    locale = getLocale();
    const els = document.querySelectorAll("[data-i18n]");
    els.forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    const titleEls = document.querySelectorAll("title[data-i18n-title]");
    titleEls.forEach(function (el) {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      const key = el.getAttribute("data-i18n-aria-label");
      if (key) el.setAttribute("aria-label", t(key));
    });
    const dir = getDirection();
    try {
      document.documentElement.setAttribute("dir", dir);
      document.documentElement.setAttribute("lang", locale);
      if (document.body) {
        document.body.setAttribute("dir", dir);
        document.body.setAttribute("lang", locale);
      }
    } catch (_) {
      /* ignore */
    }
    const cabinet = document.getElementById("lexiom-cabinet");
    if (cabinet) cabinet.setAttribute("dir", dir);
    const mainWrap = document.getElementById("lexiom-main-wrap");
    if (mainWrap) mainWrap.setAttribute("dir", dir);
  }

  window.lexiomI18n = {
    t,
    applyI18n,
    getLocale,
    getDirection,
  };
})();
