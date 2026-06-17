/* i18n.js — lightweight internationalization.
 *
 * Apple-style language selector on first run. Strings below cover onboarding
 * and the primary UI; t('key') falls back to English, then to the key itself,
 * so partially-translated locales degrade gracefully.
 */
const I18n = (() => {
  const LANGS = [
    { code: 'en', label: 'English',    native: 'English',    flag: '🇺🇸', rtl: false },
    { code: 'es', label: 'Spanish',    native: 'Español',    flag: '🇪🇸', rtl: false },
    { code: 'fr', label: 'French',     native: 'Français',   flag: '🇫🇷', rtl: false },
    { code: 'de', label: 'German',     native: 'Deutsch',    flag: '🇩🇪', rtl: false },
    { code: 'he', label: 'Hebrew',     native: 'עברית',      flag: '🇮🇱', rtl: true  },
    { code: 'ar', label: 'Arabic',     native: 'العربية',     flag: '🇸🇦', rtl: true  },
  ];

  const STR = {
    en: {
      welcome: 'Welcome to', choose_language: 'Choose your language', continue: 'Continue',
      get_started: 'Get Started', sign_in: 'Sign In', create_profile: 'Create your profile',
      your_name: 'Your name', username: 'Username', passcode: 'Passcode (optional)',
      login_hint: 'This stays on your device. No account needed.',
      online: 'Online', quick_dial: 'Quick Dial', hold_to_edit: 'Hold to edit',
      add_contact: 'Add Contact', hold_to_set: 'Hold to set', current_ride: 'Current Ride',
      no_active_ride: 'No active ride', start_ride: 'Start Ride', end_ride: 'End Ride',
      home: 'Home', apps: 'Apps', theme: 'Theme', settings: 'Settings', lock: 'Lock',
      search_places: 'Search places…', speed: 'Speed', weather: 'Weather',
      distance: 'Distance', avg_speed: 'Avg speed', heart_rate: 'Heart rate',
    },
    es: {
      welcome: 'Bienvenido a', choose_language: 'Elige tu idioma', continue: 'Continuar',
      get_started: 'Comenzar', sign_in: 'Iniciar sesión', create_profile: 'Crea tu perfil',
      your_name: 'Tu nombre', username: 'Usuario', passcode: 'Código (opcional)',
      login_hint: 'Se guarda en tu dispositivo. No requiere cuenta.',
      online: 'En línea', quick_dial: 'Marcación rápida', hold_to_edit: 'Mantén para editar',
      add_contact: 'Añadir contacto', hold_to_set: 'Mantén para fijar', current_ride: 'Viaje actual',
      no_active_ride: 'Sin viaje activo', start_ride: 'Iniciar viaje', end_ride: 'Terminar',
      home: 'Inicio', apps: 'Apps', theme: 'Tema', settings: 'Ajustes', lock: 'Bloquear',
      search_places: 'Buscar lugares…', speed: 'Velocidad', weather: 'Clima',
      distance: 'Distancia', avg_speed: 'Vel. media', heart_rate: 'Pulso',
    },
    fr: {
      welcome: 'Bienvenue sur', choose_language: 'Choisissez votre langue', continue: 'Continuer',
      get_started: 'Commencer', sign_in: 'Se connecter', create_profile: 'Créez votre profil',
      your_name: 'Votre nom', username: "Nom d'utilisateur", passcode: 'Code (facultatif)',
      login_hint: 'Reste sur votre appareil. Aucun compte requis.',
      online: 'En ligne', quick_dial: 'Numérotation rapide', hold_to_edit: 'Maintenir pour modifier',
      add_contact: 'Ajouter un contact', hold_to_set: 'Maintenir pour définir', current_ride: 'Trajet actuel',
      no_active_ride: 'Aucun trajet', start_ride: 'Démarrer', end_ride: 'Terminer',
      home: 'Accueil', apps: 'Apps', theme: 'Thème', settings: 'Réglages', lock: 'Verrouiller',
      search_places: 'Rechercher…', speed: 'Vitesse', weather: 'Météo',
      distance: 'Distance', avg_speed: 'Vit. moy.', heart_rate: 'Pouls',
    },
    de: {
      welcome: 'Willkommen bei', choose_language: 'Sprache wählen', continue: 'Weiter',
      get_started: 'Loslegen', sign_in: 'Anmelden', create_profile: 'Profil erstellen',
      your_name: 'Dein Name', username: 'Benutzername', passcode: 'Code (optional)',
      login_hint: 'Bleibt auf deinem Gerät. Kein Konto nötig.',
      online: 'Online', quick_dial: 'Kurzwahl', hold_to_edit: 'Halten zum Bearbeiten',
      add_contact: 'Kontakt hinzufügen', hold_to_set: 'Halten zum Festlegen', current_ride: 'Aktuelle Fahrt',
      no_active_ride: 'Keine Fahrt aktiv', start_ride: 'Fahrt starten', end_ride: 'Beenden',
      home: 'Start', apps: 'Apps', theme: 'Thema', settings: 'Einstellungen', lock: 'Sperren',
      search_places: 'Orte suchen…', speed: 'Tempo', weather: 'Wetter',
      distance: 'Distanz', avg_speed: 'Ø Tempo', heart_rate: 'Puls',
    },
    he: {
      welcome: 'ברוכים הבאים אל', choose_language: 'בחר שפה', continue: 'המשך',
      get_started: 'בואו נתחיל', sign_in: 'התחברות', create_profile: 'יצירת פרופיל',
      your_name: 'השם שלך', username: 'שם משתמש', passcode: 'קוד (אופציונלי)',
      login_hint: 'נשמר במכשיר שלך. ללא צורך בחשבון.',
      online: 'מחובר', quick_dial: 'חיוג מהיר', hold_to_edit: 'החזק לעריכה',
      add_contact: 'הוסף איש קשר', hold_to_set: 'החזק להגדרה', current_ride: 'רכיבה נוכחית',
      no_active_ride: 'אין רכיבה פעילה', start_ride: 'התחל רכיבה', end_ride: 'סיום',
      home: 'בית', apps: 'אפליקציות', theme: 'ערכת נושא', settings: 'הגדרות', lock: 'נעילה',
      search_places: 'חיפוש מקומות…', speed: 'מהירות', weather: 'מזג אוויר',
      distance: 'מרחק', avg_speed: 'מהירות ממוצעת', heart_rate: 'דופק',
    },
    ar: {
      welcome: 'مرحبًا بك في', choose_language: 'اختر لغتك', continue: 'متابعة',
      get_started: 'ابدأ', sign_in: 'تسجيل الدخول', create_profile: 'أنشئ ملفك',
      your_name: 'اسمك', username: 'اسم المستخدم', passcode: 'رمز (اختياري)',
      login_hint: 'يبقى على جهازك. لا حاجة لحساب.',
      online: 'متصل', quick_dial: 'اتصال سريع', hold_to_edit: 'اضغط للتعديل',
      add_contact: 'إضافة جهة', hold_to_set: 'اضغط للتعيين', current_ride: 'الرحلة الحالية',
      no_active_ride: 'لا توجد رحلة', start_ride: 'ابدأ الرحلة', end_ride: 'إنهاء',
      home: 'الرئيسية', apps: 'التطبيقات', theme: 'السمة', settings: 'الإعدادات', lock: 'قفل',
      search_places: 'ابحث عن أماكن…', speed: 'السرعة', weather: 'الطقس',
      distance: 'المسافة', avg_speed: 'متوسط', heart_rate: 'النبض',
    },
  };

  let lang = (typeof Store !== 'undefined' && Store.get('language')) || 'en';

  function t(key) { return (STR[lang] && STR[lang][key]) || STR.en[key] || key; }
  function set(code) {
    lang = code;
    if (typeof Store !== 'undefined') Store.set('language', code);
    const meta = LANGS.find((l) => l.code === code) || LANGS[0];
    document.documentElement.lang = code;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
  }
  function current() { return lang; }
  function meta(code) { return LANGS.find((l) => l.code === (code || lang)); }

  return { LANGS, t, set, current, meta };
})();
