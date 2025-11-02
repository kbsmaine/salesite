// Firebase v9 modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, query, where, orderBy, serverTimestamp, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// ---- Init Firebase ----
const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ---- DOM refs ----
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const authModal = document.getElementById('auth-modal');
const authTitle = document.getElementById('auth-title');
const authEmail = document.getElementById('auth-email');
const authPass = document.getElementById('auth-pass');
const authSubmit = document.getElementById('auth-submit');
const authSwitch = document.getElementById('auth-switch');
const authError = document.getElementById('auth-error');
const userEmailSpan = document.getElementById('user-email');

const listingModal = document.getElementById('listing-modal');
const listingError = document.getElementById('listing-error');
const listingTitle = document.getElementById('listing-title');
const lId = document.getElementById('l-id');
const lTitle = document.getElementById('l-title');
const lPrice = document.getElementById('l-price');
const lCategory = document.getElementById('l-category');
const lDesc = document.getElementById('l-desc');
const lImage = document.getElementById('l-image');
const listingSave = document.getElementById('listing-save');

const adminModal = document.getElementById('admin-modal');
const adminBtn = document.getElementById('btn-admin');
const catName = document.getElementById('cat-name');
const catSlug = document.getElementById('cat-slug');
const catAdd = document.getElementById('cat-add');
const catList = document.getElementById('cat-list');

const grid = document.getElementById('grid');
const btnNew = document.getElementById('btn-new');
const btnClear = document.getElementById('btn-clear');
const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('category-filter');

let categories = []; // {id, name, slug}
let listings = [];   // client cache for search

// ---- Helpers ----
const modalOpen = (m) => { if (!m.open) m.showModal(); };
const modalClose = (m) => { if (m.open) m.close(); };

function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function isAdminEmail(adminDoc, email) {
  return adminDoc && Array.isArray(adminDoc.emails) && adminDoc.emails.includes(email);
}

async function fetchAdmins() {
  const docRef = doc(db, 'meta', 'admins');
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : { emails: [] };
}

async function loadCategories() {
  categories = [];
  const qSnap = await getDocs(collection(db, 'categories'));
  qSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));
  categories.sort((a,b)=> a.name.localeCompare(b.name));

  // Fill filter and form selects
  categoryFilter.innerHTML = `<option value="">All categories</option>`
    + categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
  lCategory.innerHTML = `<option value="">Select…</option>`
    + categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
}

function card(listing, me, isAdmin) {
  const canEdit = me && (listing.userId === me.uid || isAdmin);
  return `
  <div class="card">
    <img class="item-img" src="${listing.imageUrl || 'https://picsum.photos/seed/'+listing.id+'/600/400'}" alt="item" />
    <div class="title">${listing.title}</div>
    <div class="row" style="justify-content:space-between;margin-top:6px">
      <span class="badge">${listing.category}</span>
      <span class="price">$${listing.price}</span>
    </div>
    <div class="meta" style="margin-top:6px">${listing.userEmail || ''}</div>
    <p style="margin-top:8px">${(listing.description||'').slice(0,140)}${(listing.description||'').length>140?'…':''}</p>
    <div class="row end">
      ${canEdit ? `<button class="btn small" data-edit="${listing.id}">Edit</button>` : ''}
      ${canEdit ? `<button class="btn small secondary" data-del="${listing.id}">Delete</button>` : ''}
    </div>
  </div>`;
}

function render(me, isAdmin) {
  const q = (searchInput.value||'').toLowerCase().trim();
  const cat = categoryFilter.value;
  let filtered = listings.filter(x => (cat? x.category===cat : true) && (q? (x.title.toLowerCase().includes(q) || (x.description||'').toLowerCase().includes(q)) : true));
  grid.innerHTML = filtered.map(x => card(x, me, isAdmin)).join('') || `<p class="muted">No listings yet.</p>`;

  // attach events
  grid.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=> openEdit(btn.getAttribute('data-edit')));
  });
  grid.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteListing(btn.getAttribute('data-del')));
  });
}

async function loadListings() {
  listings = [];
  const qSnap = await getDocs(collection(db, 'listings'));
  qSnap.forEach(d => listings.push({ id: d.id, ...d.data() }));
  listings.sort((a,b)=> (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

function clearForm() {
  lId.value = "";
  lTitle.value = "";
  lPrice.value = "";
  lCategory.value = "";
  lDesc.value = "";
  lImage.value = "";
}

// ---- CRUD ----
async function upsertListing(me) {
  listingError.textContent = "";
  const id = lId.value;
  const payload = {
    title: lTitle.value.trim(),
    price: lPrice.value.trim(),
    category: lCategory.value,
    description: lDesc.value.trim(),
    userId: me.uid,
    userEmail: me.email,
    isActive: true,
    createdAt: serverTimestamp()
  };
  if (!payload.title || !payload.price || !payload.category) {
    listingError.textContent = "Title, price, and category are required.";
    return;
  }

  // handle image upload if picked
  let imageUrl = null;
  if (lImage.files && lImage.files[0]) {
    const file = lImage.files[0];
    const path = `listings/${me.uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const r = sRef(storage, path);
    await uploadBytes(r, file);
    imageUrl = await getDownloadURL(r);
  }

  if (id) {
    const ref = doc(db, 'listings', id);
    const existing = listings.find(x => x.id === id) || {};
    await updateDoc(ref, {
      ...payload,
      createdAt: existing.createdAt || serverTimestamp(),
      imageUrl: imageUrl || existing.imageUrl || null
    });
  } else {
    await addDoc(collection(db, 'listings'), {
      ...payload,
      imageUrl: imageUrl
    });
  }
  await loadListings();
  render(auth.currentUser, window.__isAdmin === true);
  modalClose(listingModal);
  clearForm();
}

async function openEdit(id) {
  const item = listings.find(x => x.id === id);
  if (!item) return;
  listingTitle.textContent = "Edit Listing";
  lId.value = item.id;
  lTitle.value = item.title || "";
  lPrice.value = item.price || "";
  lCategory.value = item.category || "";
  lDesc.value = item.description || "";
  modalOpen(listingModal);
}

async function deleteListing(id) {
  if (!confirm("Delete this listing?")) return;
  await deleteDoc(doc(db, 'listings', id));
  await loadListings();
  render(auth.currentUser, window.__isAdmin === true);
}

// ---- Admin ----
async function renderCategories() {
  catList.innerHTML = categories.map(c => `
    <li>
      <span>${c.name} <code>${c.slug}</code></span>
      <button class="btn small secondary" data-del-cat="${c.id}">Delete</button>
    </li>
  `).join('');
  catList.querySelectorAll('[data-del-cat]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      if (!confirm('Delete this category?')) return;
      await deleteDoc(doc(db,'categories', b.getAttribute('data-del-cat')));
      await loadCategories();
      renderCategories();
    });
  });
}

// ---- Events ----
btnLogin.addEventListener('click', ()=>{
  authTitle.textContent = "Login";
  authSubmit.dataset.mode = "login";
  authSwitch.textContent = "Need an account? Click Register on the top bar.";
  authError.textContent = "";
  modalOpen(authModal);
});
btnRegister.addEventListener('click', ()=>{
  authTitle.textContent = "Register";
  authSubmit.dataset.mode = "register";
  authSwitch.textContent = "Already have an account? Click Login on the top bar.";
  authError.textContent = "";
  modalOpen(authModal);
});
btnLogout.addEventListener('click', async ()=>{
  await signOut(auth);
});
authSubmit.addEventListener('click', async (e)=>{
  e.preventDefault();
  authError.textContent = "";
  const mode = authSubmit.dataset.mode || "login";
  try {
    if (mode === "register") {
      await createUserWithEmailAndPassword(auth, authEmail.value.trim(), authPass.value);
    } else {
      await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPass.value);
    }
    modalClose(authModal);
  } catch (err) {
    authError.textContent = err.message || "Auth error";
  }
});

btnNew.addEventListener('click', ()=>{
  if (!auth.currentUser) { alert("Please log in first."); return; }
  listingTitle.textContent = "New Listing";
  clearForm();
  modalOpen(listingModal);
});
listingSave.addEventListener('click', async (e)=>{
  e.preventDefault();
  if (!auth.currentUser) { alert("Please log in first."); return; }
  try { await upsertListing(auth.currentUser); }
  catch(err){ listingError.textContent = err.message || "Save error"; }
});

btnClear.addEventListener('click', ()=>{
  searchInput.value = "";
  categoryFilter.value = "";
  render(auth.currentUser, window.__isAdmin === true);
});
searchInput.addEventListener('input', ()=> render(auth.currentUser, window.__isAdmin === true));
categoryFilter.addEventListener('change', ()=> render(auth.currentUser, window.__isAdmin === true));

adminBtn.addEventListener('click', ()=>{
  if (!window.__isAdmin) return;
  modalOpen(adminModal);
  renderCategories();
});
catAdd.addEventListener('click', async (e)=>{
  e.preventDefault();
  if (!window.__isAdmin) return;
  const name = catName.value.trim();
  const slug = (catSlug.value.trim() || slugify(name));
  if (!name || !slug) return;
  await addDoc(collection(db,'categories'), { name, slug });
  catName.value = ""; catSlug.value = "";
  await loadCategories(); renderCategories(); await loadListings(); render(auth.currentUser, window.__isAdmin === true);
});

// ---- Auth state ----
onAuthStateChanged(auth, async (user)=>{
  const admins = await fetchAdmins();
  const email = user?.email || "";
  window.__isAdmin = user ? isAdminEmail(admins, email) : false;

  document.getElementById('btn-login').classList.toggle('hidden', !!user);
  document.getElementById('btn-register').classList.toggle('hidden', !!user);
  document.getElementById('btn-logout').classList.toggle('hidden', !user);
  adminBtn.classList.toggle('hidden', !window.__isAdmin);
  userEmailSpan.textContent = user ? email : "";

  await loadCategories();
  await loadListings();
  render(user, window.__isAdmin);
});
