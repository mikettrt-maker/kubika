let cachedUsers = null;
let libros = [];
let book = null;
let rendition = null;
let libroActual = null;
let currentUser = null;

async function loadUsers() {
  if (cachedUsers) return cachedUsers;
  try {
    const res = await fetch('../kubika-usuarios.csv');
    const text = await res.text();
    const lines = text.split('\n').slice(1);
    cachedUsers = lines.map(line => {
      const [, username, email, password] = line.split(',');
      return { username: username?.trim(), email: email?.trim(), password: password?.trim() };
    }).filter(u => u.email);
    return cachedUsers;
  } catch {
    return [];
  }
}

const authSection = document.getElementById('auth-section');
const catalogSection = document.getElementById('catalog-section');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');
const catalogo = document.getElementById('catalogo');
const epubModal = document.getElementById('epub-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitulo = document.getElementById('modal-titulo');
const modalCerrar = document.getElementById('modal-cerrar');
const epubViewer = document.getElementById('epub-viewer');
const epubViewerContainer = document.getElementById('epub-viewer-container');
const pageInfo = document.getElementById('page-info');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnDownload = document.getElementById('btn-download');

function init() {
  const saved = localStorage.getItem('kubika_lib_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    mostrarCatalogo();
  } else {
    authSection.classList.remove('hidden');
  }
}

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.textContent = '';
  loginBtn.textContent = 'Ingresando...';
  loginBtn.disabled = true;

  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  const users = await loadUsers();
  const match = users.find(u => u.email === email && u.password === password);

  loginBtn.textContent = 'Ingresar';
  loginBtn.disabled = false;

  if (!match) {
    loginError.textContent = 'Email o contraseña incorrectos';
    return;
  }

  currentUser = { email, username: match.username };
  localStorage.setItem('kubika_lib_user', JSON.stringify(currentUser));
  mostrarCatalogo();
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('kubika_lib_user');
  currentUser = null;
  location.reload();
});

async function mostrarCatalogo() {
  authSection.classList.add('hidden');
  catalogSection.classList.remove('hidden');

  const res = await fetch('data.json');
  libros = await res.json();
  renderizarCatalogo(libros);
}

function renderizarCatalogo(lista) {
  catalogo.innerHTML = '';

  const categorias = {};
  lista.forEach(libro => {
    const cat = libro.categoria || 'General';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(libro);
  });

  const entries = Object.entries(categorias);
  if (entries.length === 0) {
    catalogo.innerHTML = '<div class="sin-resultados">No se encontraron libros</div>';
    return;
  }

  entries.forEach(([categoria, librosCat]) => {
    const section = document.createElement('section');
    section.className = 'categoria';

    const header = document.createElement('div');
    header.className = 'categoria-header';
    header.innerHTML = `<h2>${categoria}</h2><span class="count">${librosCat.length}</span>`;
    section.appendChild(header);

    const fila = document.createElement('div');
    fila.className = 'fila';

    librosCat.forEach(libro => {
      const card = document.createElement('div');
      card.className = 'libro-card';
      card.dataset.id = libro.id;

      const img = document.createElement('img');
      img.className = 'portada';
      img.loading = 'lazy';
      img.alt = libro.titulo;
      img.src = libro.portada;
      img.onerror = function() {
        this.style.display = 'none';
        const ph = document.createElement('div');
        ph.className = 'portada-placeholder';
        ph.textContent = libro.titulo;
        this.parentNode.insertBefore(ph, this);
      };

      const info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = `<div class="titulo">${libro.titulo}</div><div class="autor">${libro.autor}</div>`;

      card.appendChild(img);
      card.appendChild(info);

      card.addEventListener('click', () => abrirEPUB(libro));
      fila.appendChild(card);
    });

    section.appendChild(fila);
    catalogo.appendChild(section);
  });
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) {
    renderizarCatalogo(libros);
    return;
  }
  const filtrados = libros.filter(l =>
    l.titulo.toLowerCase().includes(q) || l.autor.toLowerCase().includes(q)
  );
  renderizarCatalogo(filtrados);
});

async function abrirEPUB(libro) {
  libroActual = libro;
  modalTitulo.textContent = libro.titulo;
  epubModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  btnDownload.href = libro.epub;
  btnDownload.textContent = 'Descargar EPUB';

  epubViewer.innerHTML = '';
  pageInfo.textContent = 'Cargando...';

  try {
    book = ePub(libro.epub);
    rendition = book.renderTo('epub-viewer', {
      width: '100%',
      height: epubViewerContainer.clientHeight - 24,
      spread: 'none',
      flow: 'paginated'
    });

    await rendition.display();

    rendition.on('relocated', function(location) {
      if (location.start.percentage != null) {
        const pct = Math.round(location.start.percentage * 100);
        pageInfo.textContent = `${pct}%`;
      } else {
        pageInfo.textContent = 'Leyendo...';
      }
    });

  } catch {
    epubViewer.innerHTML = '<div class="sin-resultados" style="padding:40px">Error al cargar el libro</div>';
    pageInfo.textContent = 'Error al cargar';
  }
}

btnPrev.addEventListener('click', () => {
  if (rendition) rendition.prev();
});

btnNext.addEventListener('click', () => {
  if (rendition) rendition.next();
});

function cerrarModal() {
  epubModal.classList.add('hidden');
  document.body.style.overflow = '';
  if (rendition) {
    rendition.destroy();
    rendition = null;
  }
  if (book) {
    book.destroy();
    book = null;
  }
  libroActual = null;
  epubViewer.innerHTML = '';
}

modalCerrar.addEventListener('click', cerrarModal);
modalOverlay.addEventListener('click', cerrarModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !epubModal.classList.contains('hidden')) cerrarModal();
  if (e.key === 'ArrowLeft' && rendition) btnPrev.click();
  if (e.key === 'ArrowRight' && rendition) btnNext.click();
});

init();
