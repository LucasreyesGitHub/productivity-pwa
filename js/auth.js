// auth.js — Authentication: login, register, password recovery

// ── Tab switching ──────────────────────────────────────
function showTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-login').classList.add('hidden');
  document.getElementById('tab-register').classList.add('hidden');
  document.getElementById('tab-' + tab).classList.remove('hidden');
  // Use passed element reference instead of implicit window.event (Firefox fix)
  el?.classList.add('active');
  clearAuthMsg();
}

// ── Auth message display ───────────────────────────────
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.className = 'auth-error auth-error--error';
  el.classList.remove('hidden');
}

function showAuthSuccess(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.className = 'auth-error auth-error--success';
  el.classList.remove('hidden');
}

function clearAuthMsg() {
  const el = document.getElementById('auth-error');
  el.classList.add('hidden');
  el.className = 'auth-error hidden';
}

// ── Loading state helpers ──────────────────────────────
function setAuthLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Cargando...' : btn.dataset.originalText;
}

// ── Auth actions ───────────────────────────────────────
async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showAuthError('Completá todos los campos.');
  setAuthLoading('login-btn', true);
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  setAuthLoading('login-btn', false);
  if (error) showAuthError(error.message);
}

async function register() {
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  if (!email || !pass || !pass2) return showAuthError('Completá todos los campos.');
  if (pass.length < 8) return showAuthError('La contraseña debe tener al menos 8 caracteres.');
  if (pass !== pass2) return showAuthError('Las contraseñas no coinciden.');
  setAuthLoading('register-btn', true);
  const { error } = await sb.auth.signUp({
    email, password: pass,
    options: { emailRedirectTo: 'https://productivity-pwa.vercel.app' }
  });
  setAuthLoading('register-btn', false);
  if (error) showAuthError(error.message);
  else showAuthSuccess('¡Cuenta creada! Revisá tu email para confirmar.');
}

async function forgotPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) return showAuthError('Ingresá tu email primero.');
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://productivity-pwa.vercel.app',
  });
  if (error) showAuthError(error.message);
  else showAuthSuccess('✓ Te enviamos un email para resetear la contraseña.');
}

async function logout() {
  await sb.auth.signOut();
}

async function saveNewPassword() {
  const pass  = document.getElementById('new-pass').value;
  const pass2 = document.getElementById('new-pass2').value;
  const errEl = document.getElementById('set-pass-error');
  errEl.classList.add('hidden');
  if (pass.length < 8) { errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'; errEl.classList.remove('hidden'); return; }
  if (pass !== pass2)  { errEl.textContent = 'Las contraseñas no coinciden.'; errEl.classList.remove('hidden'); return; }
  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) { errEl.textContent = error.message; errEl.classList.remove('hidden'); return; }
  document.getElementById('set-password-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
}

// ── Auth state listener ────────────────────────────────
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('set-password-screen').classList.remove('hidden');
    return;
  }
  if (session) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('set-password-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('user-email-label').textContent = session.user.email;
    initApp(session.user.id);
  } else {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('set-password-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.add('hidden');
  }
});
