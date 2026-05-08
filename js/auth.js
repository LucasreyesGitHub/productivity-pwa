function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-login').classList.add('hidden');
  document.getElementById('tab-register').classList.add('hidden');
  document.getElementById('tab-' + tab).classList.remove('hidden');
  event.target.classList.add('active');
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearAuthError() {
  document.getElementById('auth-error').classList.add('hidden');
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showAuthError('Completá todos los campos.');
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) showAuthError(error.message);
}

async function register() {
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  if (!email || !pass || !pass2) return showAuthError('Completá todos los campos.');
  if (pass.length < 8) return showAuthError('La contraseña debe tener al menos 8 caracteres.');
  if (pass !== pass2) return showAuthError('Las contraseñas no coinciden.');
  const { error } = await sb.auth.signUp({ email, password: pass });
  if (error) showAuthError(error.message);
  else showAuthError('¡Cuenta creada! Revisá tu email para confirmar.');
}

async function logout() {
  await sb.auth.signOut();
}

sb.auth.onAuthStateChange((event, session) => {
  if (session) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('user-email-label').textContent = session.user.email;
    initApp(session.user.id);
  } else {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
  }
});
