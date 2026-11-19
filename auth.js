(() => {
  "use strict";
  const SUPABASE_URL = "https://nkdwhymvmlpbcsithvvm.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ZbqnQtYR60oZ8tYa0uLBNg_KoXlwdLC";
  const TABLE = "planner_user_data";
  let client = null, ready = false, saveTimer = null;

  const $ = id => document.getElementById(id);
  const status = (message, isError = false) => {
    const node = $("authStatus");
    if (node) { node.textContent = message; node.style.color = isError ? "#a34d62" : ""; }
  };
  const setSignedIn = (user) => {
    window.plannerCurrentUserId = user?.id || null;
    $("signOut").hidden = !user;
    $("authForm").hidden = !!user;
    $("accountBtn").textContent = user ? "♡ В аккаунте" : "♡ Аккаунт";
    $("accountBtn").setAttribute("aria-label", user ? "Ты вошла в свой аккаунт" : "Войти в аккаунт");
    $("storageStatus").textContent = user ? "♡ Ты в своём аккаунте · подключаем синхронизацию" : "Данные хранятся на этом устройстве";
    if (user) status("Вход выполнен: " + user.email + ". Подключаю личные записи…");
    else status("Ты вышла из аккаунта. Записи на этом устройстве не удалены.");
  };
  const mergePlannerStates = (accountState, guestState) => {
    const account = accountState && typeof accountState === "object" ? accountState : {};
    const guest = guestState && typeof guestState === "object" ? guestState : {};
    const merged = { ...guest, ...account };
    const arrayKeys = ["tasks", "dailyHabits", "weeklyHabits", "notes", "diaryEntries", "calendarEntries", "archive", "quotes", "goals"];
    arrayKeys.forEach(key => {
      const byKey = new Map();
      const add = item => {
        const identity = item && typeof item === "object" && item.id != null
          ? String(item.id)
          : JSON.stringify(item);
        const previous = byKey.get(identity);
        if (previous && item && typeof item === "object" && !Array.isArray(item)) {
          const combined = { ...previous, ...item };
          ["doneDates", "doneWeeks"].forEach(field => {
            if (previous[field] || item[field]) combined[field] = { ...(previous[field] || {}), ...(item[field] || {}) };
          });
          byKey.set(identity, combined);
        } else {
          byKey.set(identity, item);
        }
      };
      (Array.isArray(account[key]) ? account[key] : []).forEach(add);
      (Array.isArray(guest[key]) ? guest[key] : []).forEach(add);
      merged[key] = Array.from(byKey.values());
    });
    ["moods", "selfCareLog"].forEach(key => {
      merged[key] = {
        ...(account[key] && typeof account[key] === "object" ? account[key] : {}),
        ...(guest[key] && typeof guest[key] === "object" ? guest[key] : {})
      };
    });
    // Re-run the app's one-time migration if the guest copy still uses the older task format.
    const guestHasLegacyTasks = Array.isArray(guest.dailyHabits) && guest.dailyHabits.length > 0;
    const guestHasDayTasks = Array.isArray(guest.tasks) && guest.tasks.some(task =>
      task && !task.date && !task.repeatDaily && Number.isInteger(Number(task.day))
    );
    if (guestHasLegacyTasks || guestHasDayTasks) merged.unifiedTasksV1 = false;
    return merged;
  };
  const loadUserData = async user => {
    ready = false;
    await (window.plannerAppReady || Promise.resolve());
    // Never leave the previous guest's planner visible while this account is loading.
    const cacheKey = "softPlanner:user:" + user.id;
    const hadCachedState = localStorage.getItem(cacheKey) !== null;
    let cachedState = {};
    try { cachedState = JSON.parse(localStorage.getItem(cacheKey) || "{}") || {}; } catch (_) { cachedState = {}; }
    window.dispatchEvent(new CustomEvent("planner-cloud-load", { detail: cachedState }));
    const { data, error } = await client.from(TABLE).select("data").eq("user_id", user.id).maybeSingle();
    if (error) {
      status("Не удалось загрузить личные данные: " + error.message + ". Локальная копия сохранена на устройстве.", true);
      $("storageStatus").textContent = "♡ Вход выполнен · есть проблема с облачной синхронизацией";
      return;
    }
    if (data?.data && typeof data.data === "object") {
      const guestRaw = localStorage.getItem("softPlanner");
      let guestState = {};
      try { guestState = guestRaw ? JSON.parse(guestRaw) || {} : {}; } catch (_) { guestState = {}; }
      const mergedState = mergePlannerStates(data.data, guestState);
      window.dispatchEvent(new CustomEvent("planner-cloud-load", { detail: mergedState }));
      status(guestRaw ? "Личные записи объединены с сохранёнными записями на устройстве." : "Твои личные записи загружены и защищены аккаунтом.");
    } else {
      const cached = hadCachedState ? localStorage.getItem(cacheKey) : null;
      const guest = localStorage.getItem("softPlanner");
      let initial = {};
      if (cached) {
        try { initial = JSON.parse(cached) || {}; } catch (_) { initial = {}; }
      } else if (guest && window.confirm("В аккаунте пока нет записей. Перенести в него твои текущие привычки, задачи и заметки? Нажми «Отмена», чтобы начать с пустого планера.")) {
        try { initial = JSON.parse(guest) || {}; } catch (_) { initial = {}; }
      }
      window.dispatchEvent(new CustomEvent("planner-cloud-load", { detail: initial }));
      status(Object.keys(initial).length ? "Подготавливаю твои записи для личного аккаунта…" : "Готово! Это твой новый личный планер.");
    }
    ready = true;
    const current = JSON.parse(localStorage.getItem("softPlanner:user:" + user.id) || "null");
    if (current) window.plannerCloudSave(current);
  };
  window.plannerCloudSave = state => {
    if (!client || !ready || !window.plannerCurrentUserId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { error } = await client.from(TABLE).upsert(
        { user_id: window.plannerCurrentUserId, data: state, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) {
        status("Не удалось синхронизировать записи. Они пока сохранены на устройстве.", true);
        $("storageStatus").textContent = "♡ Вход выполнен · есть проблема с облачной синхронизацией";
      } else {
        $("storageStatus").textContent = "♡ Ты в своём аккаунте · личные записи синхронизированы";
        status("Синхронизация завершена. Твои записи сохранены в аккаунте ♡");
      }
    }, 650);
  };

  async function init() {
    try {
      const loadSdk = () => new Promise((resolve, reject) => {
        if (window.supabase?.createClient) return resolve();
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0";
        script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
      });
      await loadSdk();
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      $("accountBtn").addEventListener("click", () => { $("accountPanel").hidden = !$("accountPanel").hidden; });
      $("closeAccount").addEventListener("click", () => { $("accountPanel").hidden = true; });
      const email = () => $("authForm").elements.email.value.trim();
      const password = () => $("authForm").elements.password.value;
      const redirectTo = window.location.origin + window.location.pathname;

      $("signInPassword").addEventListener("click", async () => {
        if (!email() || !password()) return status("Укажи email и пароль.", true);
        status("Выполняю вход…");
        const { error } = await client.auth.signInWithPassword({ email: email(), password: password() });
        if (error) status(error.message, true);
      });
      $("signUpPassword").addEventListener("click", async () => {
        if (!email() || password().length < 8) return status("Укажи email и пароль не короче 8 символов.", true);
        status("Создаю аккаунт…");
        const { data, error } = await client.auth.signUp({ email: email(), password: password(), options: { emailRedirectTo: redirectTo } });
        if (error) status(error.message, true);
        else if (!data.session) status("Проверь почту и подтверди регистрацию по ссылке.");
        else status("Аккаунт создан. Добро пожаловать! ♡");
      });
      $("signInMagic").addEventListener("click", async () => {
        if (!email()) return status("Сначала укажи email.", true);
        status("Отправляю ссылку для входа…");
        const { error } = await client.auth.signInWithOtp({ email: email(), options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
        if (error) status(error.message, true);
        else status("Ссылка отправлена на почту. Открой письмо на этом устройстве.");
      });
      $("signOut").addEventListener("click", async () => {
        ready = false;
        const { error } = await client.auth.signOut();
        if (error) status(error.message, true);
        else window.location.reload();
      });
      const { data: { session } } = await client.auth.getSession();
      if (session?.user) {
        setSignedIn(session.user);
        await loadUserData(session.user);
      }
      client.auth.onAuthStateChange((_event, session) => {
        if (session?.user && !window.plannerCurrentUserId) {
          setSignedIn(session.user);
          // Run database requests after the auth callback releases its internal lock.
          setTimeout(() => loadUserData(session.user), 0);
        } else if (!session) {
          ready = false; setSignedIn(null);
        }
      });
    } catch (error) {
      status("Авторизация пока недоступна. Проверь подключение к интернету и настройки Supabase.", true);
    }
  }
  init();
})();