/*
 * Toko Buku — UTS Pemrograman Web 1
 * Aplikasi berjalan di browser tanpa integrasi server atau basis data.
 * data.js  : sumber data awal untuk pengujian.
 * script.js: autentikasi, manipulasi DOM, validasi, stok, pemesanan, pelacakan, dan laporan.
 */
(() => {
    'use strict';
    const K = { session: 'bk_session_v1', users: 'bk_users_v1', extra: 'bk_extra_books_v1', stock: 'bk_stock_v1', cart: 'bk_cart_v1', orders: 'bk_orders_v1' };
    const PAGE = document.body.dataset.page || 'login';
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const safe = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const read = (key, fallback) => { try {
        const x = JSON.parse(localStorage.getItem(key));
        return x ?? fallback;
    }
    catch {
        return fallback;
    } };
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
    const numberFromPrice = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0;
    const normalize = (s) => String(s ?? '').trim().toLowerCase();
    const formatDate = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? String(s ?? '-') : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d); };
    const today = () => new Date().toISOString();
    // Verifikasi sesi terhadap data akun; hak akses tidak hanya mengikuti sessionStorage.
    const person = () => {
        try {
            const session = JSON.parse(sessionStorage.getItem(K.session));
            if (!session || typeof session !== 'object') return null;
            const account = allUsers().find(user =>
                user.id === session.id &&
                normalize(user.email) === normalize(session.email) &&
                user.role === session.role
            );
            return account ? {
                id: account.id,
                nama: account.nama,
                email: account.email,
                role: account.role
            } : null;
        } catch {
            return null;
        }
    };
    // Pengelolaan stok dibatasi pada akun Admin dari data.js.
    // Pembatasan di sisi browser ini belum menggantikan pemeriksaan hak akses oleh server.
    const isAdmin = () => {
        const u = person();
        return Boolean(u && u.role === 'Admin' && dataPengguna.some(account =>
            account.id === u.id && normalize(account.email) === normalize(u.email) && account.role === 'Admin'
        ));
    };
    const requireStockAdmin = () => {
        if (isAdmin()) return true;
        toast('Penambahan buku dan perubahan stok hanya dapat dilakukan oleh Admin.', 'error');
        return false;
    };
    const allUsers = () => {
        const registered = read(K.users, []);
        return [...dataPengguna, ...(Array.isArray(registered) ? registered : [])];
    };
    const inventory = () => {
        const override = read(K.stock, {});
        const extra = read(K.extra, []);
        return [...dataKatalogBuku, ...(Array.isArray(extra) ? extra : [])].map(book => {
            const stock = Number(override[book.kodeBarang] ?? book.stok);
            return {
                ...book,
                stok: Number.isSafeInteger(stock) && stock >= 0 ? stock : 0
            };
        });
    };
    const bookByCode = (code) => inventory().find(b => b.kodeBarang === code);
    const cartStorageKey = () => `${K.cart}_${normalize(person()?.email)}`;
    const cart = () => {
        const stored = read(cartStorageKey(), {});
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    };
    const saveCart = c => { write(cartStorageKey(), c); updateCartBadge(); };
    const cartCount = () => Object.values(cart()).reduce((a, v) => a + Math.max(0, Number(v) || 0), 0);
    const setStock = (code, quantity) => { const state = read(K.stock, {}); state[code] = Math.max(0, Number(quantity) || 0); write(K.stock, state); };
    const shipmentsFromSource = () => Object.values(dataTracking).map(x => ({
        no: x.nomorDO, ownerEmail: (dataPengguna.find(u => u.nama === x.nama) || {}).email || '',
        name: x.nama, expedition: x.ekspedisi, status: x.status, shipped: x.tanggalKirim,
        package: x.paket, total: numberFromPrice(x.total), subtotal: numberFromPrice(x.total),
        created: `${x.tanggalKirim}T10:00:00`, method: 'Data contoh', phone: '-', address: '-',
        lines: [], source: 'Data contoh data.js', journey: x.perjalanan
    }));
    const allOrders = () => {
        const saved = read(K.orders, []);
        return [...shipmentsFromSource(), ...(Array.isArray(saved) ? saved : [])]
            .sort((a, b) => new Date(b.created) - new Date(a.created));
    };
    const visibleOrders = () => {
        const u = person();
        if (!u) return [];
        return allOrders().filter(order => isAdmin() || normalize(order.ownerEmail) === normalize(u.email));
    };
    const shippingCosts = { 'JNE': 18000, 'Pos Indonesia': 15000, 'SiCepat': 20000 };
    const greetings = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };
    const statusTone = s => /selesai|diterima/i.test(s) ? 'success' : /perjalanan|dikirim/i.test(s) ? 'info' : 'warning';
    const statusBadge = s => `<span class="pill ${statusTone(s)}">${safe(s)}</span>`;
    const imgFor = b => safe(b?.cover || 'assets/book-placeholder.svg');
    function toast(message, tone = 'success') {
        let stack = $('#toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'toast-stack';
            stack.className = 'toast-stack';
            stack.setAttribute('role', 'status');
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
        }
        const el = document.createElement('div');
        el.className = `toast ${tone}`;
        el.textContent = message;
        stack.appendChild(el);
        setTimeout(() => el.remove(), 4200);
    }
    function openDialog(id) {
        if ((id === 'add-stock-modal' || id === 'edit-stock-modal') && !requireStockAdmin()) return;
        const el = $(`#${id}`); if (el && !el.open)
        el.showModal(); }
    function closeDialog(id) { const el = $(`#${id}`); if (el?.open)
        el.close(); }
    function initDialogs() {
        $$('[data-dialog]').forEach(el => el.addEventListener('click', () => openDialog(el.dataset.dialog)));
        $$('[data-close]').forEach(el => el.addEventListener('click', () => closeDialog(el.dataset.close)));
        $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d)
            d.close(); }));
    }
    function updateCartBadge() { const badge = $('#cart-badge'); if (badge)
        badge.textContent = String(cartCount()); }
    function renderShell() {
        const u = person();
        const icons = {
            dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
            stok: '<path d="M4 5.5C8 4 10 4 12 6c2-2 4-2 8-.5V19c-4-1.5-6-1.5-8 .5-2-2-4-2-8-.5z"/><path d="M12 6v13.5"/>',
            checkout: '<path d="M3 5h2l2.2 10h11.6l2-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
            tracking: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
            laporan: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h8"/>',
            riwayat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>'
        };
        const symbol = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
        const menus = [
            ['dashboard.html', 'dashboard', 'Beranda'],
            ['stok.html', 'stok', 'Katalog Buku'],
            ['checkout.html', 'checkout', 'Pemesanan'],
            ['tracking.html', 'tracking', 'Lacak Pengiriman'],
            ['laporan.html', 'laporan', 'Laporan Pemesanan'],
            ['riwayat.html', 'riwayat', 'Riwayat Transaksi']
        ];
        const activeName = menus.find(x => x[1] === PAGE)?.[2] || 'Beranda';
        const initials = u.nama.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
        $('#sidebar-mount').innerHTML = `
            <aside class="sidebar" aria-label="Navigasi utama">
                <a class="brand" href="dashboard.html">
                    <span class="brand-mark" aria-hidden="true"><img src="assets/logo.svg" alt="" width="45" height="45"></span><span class="brand-name">Toko <span>Buku</span></span>
                </a>
                <div class="sidebar-tagline">Buku kuliah, jadi lebih dekat.</div>
                <p class="nav-caption">JELAJAHI</p>
                <nav class="side-links" aria-label="Menu aplikasi">
                    ${menus.map(([href, key, name]) => `<a href="${href}" ${key === PAGE ? 'class="active" aria-current="page"' : ''}>
                        <span class="nav-symbol">${symbol(key)}</span><span>${name}</span>
                        ${key === 'checkout' ? '<span class="badge-count" id="cart-badge">0</span>' : ''}
                    </a>`).join('')}
                </nav>
                <div class="sidebar-reading-card">
                    <span>✳ CATATAN KECIL</span>
                    <strong>Setiap buku punya cerita.</strong>
                    <p>Mulai dari satu halaman, lanjut ke hal yang lebih besar.</p>
                </div>
                <div class="sidebar-bottom">
                    <p class="nav-caption">AKUN MASUK</p>
                    <div class="small-user">
                        <span class="avatar">${safe(initials)}</span>
                        <span><strong title="${safe(u.nama)}">${safe(u.nama)}</strong><small>${u.role === 'User' ? 'Pengguna' : safe(u.role)}</small></span>
                    </div>
                    <button class="btn btn-outline btn-sm btn-block" id="logout">Keluar Akun <span aria-hidden="true">↗</span></button>
                </div>
            </aside>`;
        const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
        $('#topbar-mount').innerHTML = `
            <header class="topbar">
                <div class="topbar-left">
                    <button class="mobile-menu" type="button" aria-label="Buka navigasi" aria-expanded="false" id="mobile-menu">☰</button>
                    <span class="crumb"><span>Menu utama</span> / ${safe(activeName)}</span>
                </div>
                <div class="topbar-right">
                    <span class="topbar-date">${safe(date)}</span>
                    <span class="topbar-separator" aria-hidden="true"></span>
                    <span class="avatar top-avatar">${safe(u.nama.charAt(0).toUpperCase())}</span>
                </div>
            </header>`;
        $('#logout').addEventListener('click', () => {
            sessionStorage.removeItem(K.session);
            location.href = 'index.html';
        });
        $('#mobile-menu').addEventListener('click', () => {
            const expanded = $('#app-shell').classList.toggle('menu-open');
            $('#mobile-menu').setAttribute('aria-expanded', String(expanded));
        });
        updateCartBadge();
        const foot = $('#footer');
        if (foot) {
            foot.textContent = `© ${new Date().getFullYear()} Toko Buku · Project UTS Pemrograman Web 1`;
        }
    }
    function initLogin() {
        if (person()) {
            location.replace('dashboard.html');
            return;
        }
        const form = $('#login-form');
        form.addEventListener('submit', e => {
            e.preventDefault();
            $('#login-error').hidden = true;
            const email = normalize($('#login-email').value), password = $('#login-password').value;
            const user = allUsers().find(x => normalize(x.email) === email && x.password === password);
            if (!user) {
                $('#login-error').hidden = false;
                $('#login-password').value = '';
                $('#login-password').focus();
                window.alert('email/password yang anda masukkan salah');
                return;
            }
            sessionStorage.setItem(K.session, JSON.stringify({ id: user.id, nama: user.nama, email: user.email, role: user.role }));
            location.href = 'dashboard.html';
        });
        $('#register-form').addEventListener('submit', e => {
            e.preventDefault();
            const name = $('#register-name').value.trim(), email = normalize($('#register-email').value), pass = $('#register-password').value;
            if (name.length < 3) {
                toast('Nama harus terdiri atas minimal 3 karakter.', 'error');
                return;
            }
            if (pass.length < 6) {
                toast('Password harus terdiri atas minimal 6 karakter.', 'error');
                return;
            }
            if (allUsers().some(u => normalize(u.email) === email)) {
                toast('Alamat email sudah terdaftar.', 'error');
                return;
            }
            const users = read(K.users, []);
            users.push({ id: Date.now(), nama: name, email, password: pass, role: 'User' });
            write(K.users, users);
            closeDialog('register-modal');
            e.target.reset();
            $('#login-email').value = email;
            toast('Akun berhasil dibuat. Silakan masuk menggunakan akun tersebut.');
        });
        $('#forgot-form').addEventListener('submit', e => {
            e.preventDefault();
            const email = normalize($('#forgot-email').value);
            $('#forgot-result').hidden = false;
            $('#forgot-result').textContent = allUsers().some(u => normalize(u.email) === email)
                ? 'Alamat email terdaftar. Pengiriman tautan pemulihan belum tersedia pada aplikasi ini.'
                : 'Jika alamat email terdaftar, informasi pemulihan dapat diberikan setelah layanan email tersedia.';
        });
    }
    function initDashboard() {
        const u = person(), orders = visibleOrders(), books = inventory();
        $('#hello').textContent = `${greetings()}, ${u.nama.split(' ')[0]}!`;
        $('#hero-subtitle').textContent = `Temukan buku yang dibutuhkan dan pantau status pemesanan melalui halaman ini.`;
        $('#metric-books').textContent = books.length;
        $('#metric-stock').textContent = books.reduce((x, b) => x + b.stok, 0).toLocaleString('id-ID');
        $('#metric-orders').textContent = orders.length;
        $('#metric-total').textContent = rupiah(orders.reduce((x, o) => x + o.total, 0));
        $('#featured-books').innerHTML = books.slice(0, 4).map(b => `<div class="book-row"><img src="${imgFor(b)}" alt="Sampul ${safe(b.namaBarang)}"><div><div class="book-name">${safe(b.namaBarang)}</div><div class="book-desc">${safe(b.kodeBarang)} · Edisi ${safe(b.edisi)}</div></div><div class="price">${safe(b.harga)}</div></div>`).join('');
        $('#latest-orders').innerHTML = orders.length ? orders.slice(0, 3).map(o => `<div class="book-row"><div class="metric-symbol" aria-hidden="true">↗</div><div><strong>${safe(o.no)}</strong><div class="caption">${safe(o.name)} · ${formatDate(o.created)}</div></div><div style="margin-left:auto">${statusBadge(o.status)}</div></div>`).join('') : `<div class="empty"><h3>Belum ada transaksi</h3><p>Buat pemesanan pertama dari menu katalog.</p></div>`;
    }
    function initStock() {
        const rows = $('#stock-rows'), q = $('#book-search');
        const admin = isAdmin();
        const addStockButton = $('[data-dialog="add-stock-modal"]');
        if (addStockButton) addStockButton.hidden = !admin;
        function render() {
            const all = inventory(), search = normalize(q.value), filtered = all.filter(b => normalize(`${b.kodeBarang} ${b.namaBarang} ${b.jenisBarang}`).includes(search));
            $('#stock-total').textContent = String(all.length);
            $('#stock-count').textContent = `${filtered.length} dari ${all.length} buku`;
            const highlights = $('#catalog-highlights');
            if (highlights) {
                const picks = filtered.slice(0, 3);
                highlights.innerHTML = picks.length ? picks.map((b, i) => `
                    <article class="catalog-book">
                        <div class="catalog-book-cover">
                            <span class="catalog-book-index">0${i + 1} / PILIHAN</span>
                            <img src="${imgFor(b)}" alt="Sampul ${safe(b.namaBarang)}" loading="lazy">
                        </div>
                        <div class="catalog-book-info">
                            <span class="catalog-book-type">${safe(b.jenisBarang)} · Edisi ${safe(b.edisi)}</span>
                            <h3>${safe(b.namaBarang)}</h3>
                            <div class="catalog-book-bottom">
                                <strong>${safe(b.harga)}</strong>
                                <button type="button" class="btn btn-soft btn-sm" data-add="${safe(b.kodeBarang)}" ${b.stok <= 0 ? 'disabled' : ''}>+ Keranjang</button>
                            </div>
                        </div>
                    </article>`).join('') : '<div class="empty">Tidak ditemukan buku yang sesuai dengan pencarian.</div>';
            }

            rows.innerHTML = filtered.length ? filtered.map(b => `
                <tr>
                    <td>
                        <div class="table-title">
                            <img src="${imgFor(b)}" alt="Sampul ${safe(b.namaBarang)}">
                            <div>
                                <strong>${safe(b.namaBarang)}</strong>
                                <small>${safe(b.kodeBarang)}</small>
                            </div>
                        </div>
                    </td>
                    <td>${safe(b.jenisBarang)}</td>
                    <td>${safe(b.edisi)}</td>
                    <td><span class="pill ${b.stok < 10 ? 'warning' : 'success'}">${b.stok.toLocaleString('id-ID')} unit</span></td>
                    <td><strong>${safe(b.harga)}</strong></td>
                    <td>
                        <div style="display:flex;gap:6px">
                            <button type="button" class="btn btn-soft btn-sm" data-add="${safe(b.kodeBarang)}" ${b.stok <= 0 ? 'disabled' : ''}>+ Pesan</button>
                            ${admin ? `<button type="button" class="btn btn-outline btn-sm" data-edit="${safe(b.kodeBarang)}">Edit</button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('') : `
                <tr>
                    <td colspan="6">
                        <div class="empty">
                            <div class="empty-illustration">🔍</div>
                            <h3>Buku tidak ditemukan</h3>
                            <p>Coba gunakan kata kunci lain.</p>
                        </div>
                    </td>
                </tr>
            `;
            $$('[data-add]').forEach(btn => btn.addEventListener('click', () => { const b = bookByCode(btn.dataset.add), c = cart(); if ((c[b.kodeBarang] || 0) >= b.stok) {
                toast('Jumlah pesanan telah mencapai batas stok yang tersedia.', 'error');
                return;
            } c[b.kodeBarang] = (c[b.kodeBarang] || 0) + 1; saveCart(c); toast(`${b.namaBarang} ditambahkan ke keranjang`); }));
            $$('[data-edit]', rows).forEach(btn => btn.addEventListener('click', () => {
                if (!requireStockAdmin()) return;
                const b = bookByCode(btn.dataset.edit);
                if (!b) return;
                $('#edit-code').value = b.kodeBarang;
                $('#edit-name').textContent = b.namaBarang;
                $('#edit-stock').value = b.stok;
                openDialog('edit-stock-modal');
            }));
        }
        q.addEventListener('input', render);
        $('#add-stock-form').addEventListener('submit', e => {
            e.preventDefault();
            if (!requireStockAdmin()) return;
            const code = $('#stock-code').value.trim().toUpperCase(), name = $('#stock-name').value.trim(), type = $('#stock-type').value, ed = $('#stock-edition').value, qty = Number($('#stock-qty').value), price = Number($('#stock-price').value);
            if (!/^[A-Z0-9-]{4,18}$/.test(code)) {
                toast('Kode buku harus 4–18 karakter huruf/angka', 'error');
                return;
            }
            if (inventory().some(b => normalize(b.kodeBarang) === normalize(code))) {
                toast('Kode buku sudah digunakan.', 'error');
                return;
            }
            if (!name || !Number.isSafeInteger(qty) || qty < 0 || !Number.isSafeInteger(price) || price <= 0 ||
                !Number.isSafeInteger(Number(ed)) || Number(ed) < 1 ||
                !['Buku Ajar', 'Referensi', 'Modul'].includes(type)) {
                toast('Periksa kembali nama, stok, dan harga buku.', 'error');
                return;
            }
            const list = read(K.extra, []);
            list.push({ kodeBarang: code, namaBarang: name, jenisBarang: type, edisi: ed, stok: qty, harga: rupiah(price).replace(/,00$/, ''), cover: 'assets/book-placeholder.svg' });
            write(K.extra, list);
            e.target.reset();
            closeDialog('add-stock-modal');
            render();
            toast('Buku baru berhasil ditambahkan ke katalog');
        });
        $('#edit-stock-form').addEventListener('submit', e => {
            e.preventDefault();
            if (!requireStockAdmin()) return;
            const qty = Number($('#edit-stock').value), code = $('#edit-code').value;
            if (!Number.isSafeInteger(qty) || qty < 0) {
                toast('Stok harus berupa bilangan bulat bernilai nol atau lebih.', 'error');
                return;
            }
            if (!bookByCode(code)) {
                toast('Data buku tidak ditemukan', 'error');
                return;
            }
            setStock(code, qty);
            closeDialog('edit-stock-modal');
            render();
            toast('Jumlah stok berhasil diperbarui');
        });
        render();
    }
    function initCheckout() {
        const u = person();
        $('#buyer-name').value = u.nama;
        $('#buyer-email').value = u.email;
        const codeSelect = $('#cart-book'), qtyInput = $('#cart-add-qty'), delivery = $('#delivery');
        function options() { codeSelect.innerHTML = '<option value="">Pilih buku dari katalog</option>' + inventory().map(b => `<option value="${safe(b.kodeBarang)}" ${b.stok <= 0 ? 'disabled' : ''}>${safe(b.namaBarang)} (stok ${b.stok})</option>`).join(''); }
        function render() {
            const items = cart();
            const rows = Object.entries(items)
                .map(([code, qty]) => ({ book: bookByCode(code), qty: Number(qty) }))
                .filter(item => item.book && Number.isSafeInteger(item.qty) && item.qty > 0);
            const invalidStock = rows.some(item => item.qty > item.book.stok);
            const warning = $('#cart-warning');
            if (warning) {
                warning.hidden = !invalidStock;
                warning.textContent = invalidStock
                    ? 'Stok buku telah berubah. Sesuaikan jumlah atau hapus buku tersebut sebelum melanjutkan pemesanan.'
                    : '';
            }
            const subtotal = rows.reduce((sum, x) => sum + numberFromPrice(x.book.harga) * x.qty, 0);
            const shipping = rows.length ? shippingCosts[delivery.value] || 0 : 0;
            const total = subtotal + shipping;
            $('#cart-list').innerHTML = rows.length ? rows.map(x => `<div class="cart-item"><img src="${imgFor(x.book)}" alt="${safe(x.book.namaBarang)}"><div><strong>${safe(x.book.namaBarang)}</strong><small>${safe(x.book.kodeBarang)} · ${safe(x.book.harga)} / buku</small></div><label class="field"><span class="visually-hidden">Jumlah ${safe(x.book.namaBarang)}</span><input class="input" type="number" min="1" max="${x.book.stok}" value="${x.qty}" data-qty="${safe(x.book.kodeBarang)}" aria-label="Jumlah ${safe(x.book.namaBarang)}"></label><strong class="line-total right">${rupiah(numberFromPrice(x.book.harga) * x.qty)}</strong><button class="cart-remove" type="button" aria-label="Hapus ${safe(x.book.namaBarang)}" data-remove="${safe(x.book.kodeBarang)}">×</button></div>`).join('') : `<div class="empty"><div class="empty-illustration">🛒</div><h3>Keranjang masih kosong</h3><p>Tambahkan buku dari pilihan di bawah atau dari halaman katalog.</p></div>`;
            $('#sum-items').textContent = `${rows.reduce((x, b) => x + b.qty, 0)} buku`;
            $('#sum-subtotal').textContent = rupiah(subtotal);
            $('#sum-shipping').textContent = rupiah(shipping);
            $('#sum-total').textContent = rupiah(total);
            $('#place-order').disabled = !rows.length || invalidStock;
            $$('[data-remove]').forEach(b => b.addEventListener('click', () => { const c = cart(); delete c[b.dataset.remove]; saveCart(c); render(); toast('Buku dihapus dari keranjang'); }));
            $$('[data-qty]').forEach(inp => inp.addEventListener('change', () => { const b = bookByCode(inp.dataset.qty); let amount = Number(inp.value); if (!Number.isInteger(amount) || amount < 1) {
                amount = 1;
                toast('Minimal pembelian 1 buku', 'error');
            } if (amount > b.stok) {
                amount = b.stok;
                toast('Jumlah tidak boleh melebihi stok', 'error');
            } const c = cart(); if (amount > 0)
                c[b.kodeBarang] = amount;
            else
                delete c[b.kodeBarang];
            saveCart(c);
            // Tunggu event change/blur selesai sebelum mengganti input yang aktif.
            setTimeout(render, 0);
        }));
            return { rows, subtotal, shipping, total };
        }
        options();
        delivery.addEventListener('change', render);
        $('#add-to-cart-form').addEventListener('submit', e => {
            e.preventDefault();
            const b = bookByCode(codeSelect.value), qty = Number(qtyInput.value);
            if (!b) {
                toast('Silakan pilih buku', 'error');
                return;
            }
            if (!Number.isInteger(qty) || qty < 1) {
                toast('Jumlah minimal 1 buku', 'error');
                return;
            }
            const c = cart();
            if ((c[b.kodeBarang] || 0) + qty > b.stok) {
                toast(`Stok ${b.namaBarang} tidak mencukupi`, 'error');
                return;
            }
            c[b.kodeBarang] = (c[b.kodeBarang] || 0) + qty;
            saveCart(c);
            render();
            toast('Buku ditambahkan ke keranjang');
        });
        $('#checkout-form').addEventListener('submit', e => {
            e.preventDefault();
            const { rows, subtotal, shipping, total } = render();
            if (!rows.length) {
                toast('Tambahkan minimal satu buku', 'error');
                return;
            }
            if (rows.some(item => item.qty > item.book.stok)) {
                toast('Jumlah di keranjang melebihi stok yang tersedia', 'error');
                return;
            }
            if (!$('#checkout-form').checkValidity()) {
                $('#checkout-form').reportValidity();
                return;
            }
            if (!/^[0-9+\s()-]{9,17}$/.test($('#buyer-phone').value.trim())) {
                toast('Nomor telepon tidak valid', 'error');
                $('#buyer-phone').focus();
                return;
            }
            if ($('#buyer-address').value.trim().length < 12) {
                toast('Alamat pengiriman minimal 12 karakter', 'error');
                $('#buyer-address').focus();
                return;
            }
            if (!Object.hasOwn(shippingCosts, delivery.value)) {
                toast('Pilih salah satu layanan pengiriman yang tersedia.', 'error');
                return;
            }
            if (!['Transfer Bank', 'E-Wallet', 'COD'].includes($('#payment').value)) {
                toast('Pilih metode pembayaran yang tersedia', 'error');
                return;
            }
            for (const x of rows) {
                const stock = bookByCode(x.book.kodeBarang)?.stok ?? 0;
                if (x.qty > stock) {
                    toast(`Stok ${x.book.namaBarang} tidak mencukupi`, 'error');
                    return;
                }
            }
            const orderNo = `DO${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
            const order = {
                no: orderNo, ownerEmail: u.email, name: $('#buyer-name').value.trim(), email: $('#buyer-email').value.trim(), phone: $('#buyer-phone').value.trim(), address: $('#buyer-address').value.trim(),
                expedition: delivery.value, method: $('#payment').value, status: 'Diproses', created: today(), shipped: 'Belum dikirim', package: 'Paket Buku', subtotal, shipping, total,
                lines: rows.map(x => ({ code: x.book.kodeBarang, name: x.book.namaBarang, quantity: x.qty, unitPrice: numberFromPrice(x.book.harga) })),
                source: 'Pemesanan baru', journey: [{ waktu: new Date().toLocaleString('id-ID'), keterangan: 'Pesanan berhasil dibuat dan menunggu diproses' }]
            };
            const orders = read(K.orders, []);
            orders.push(order);
            write(K.orders, orders);
            rows.forEach(x => setStock(x.book.kodeBarang, x.book.stok - x.qty));
            saveCart({});
            $('#order-success-number').textContent = order.no;
            $('#order-success-total').textContent = rupiah(total);
            $('#success-track').href = `tracking.html?do=${encodeURIComponent(order.no)}`;
            openDialog('order-success-modal');
            options();
            render();
            e.target.reset();
            $('#buyer-name').value = u.nama;
            $('#buyer-email').value = u.email;
            render(); // Sinkronkan ringkasan setelah ekspedisi kembali ke pilihan awal.
            toast('Pemesanan berhasil disimpan pada browser ini.');
        });
        render();
    }
    function initTracking() {
        const q = $('#tracking-no'), result = $('#tracking-result'), empty = $('#tracking-empty');
        function show(order) {
            const states = ['Diproses', 'Dikirim', 'Selesai'];
            const progress = /selesai|diterima/i.test(order.status) ? 3 : /dikirim|perjalanan/i.test(order.status) ? 2 : 1;
            result.hidden = false;
            empty.hidden = true;
            $('#tracking-head').innerHTML = `<div><p class="caption">NOMOR DELIVERY ORDER</p><h2 style="margin:0">${safe(order.no)}</h2></div><div>${statusBadge(order.status)}</div>`;
            $('#tracking-progress').innerHTML = states.map((s, i) => `<div class="step ${i < progress ? (i === progress - 1 ? 'active' : 'done') : ''}">${i + 1}. ${s}</div>`).join('');
            $('#tracking-fields').innerHTML = [['Nama Pemesan', order.name], ['Ekspedisi', order.expedition], ['Tanggal Kirim', order.shipped === 'Belum dikirim' ? order.shipped : formatDate(order.shipped)], ['Jenis Paket', order.package], ['Total Pembayaran', rupiah(order.total)], ['Status Pengiriman', order.status]].map(([label, value]) => `<div><div class="detail-label">${safe(label)}</div><div class="detail-value">${safe(value)}</div></div>`).join('');
            $('#tracking-events').innerHTML = (order.journey || []).map(t => `<div class="timeline-event"><strong>${safe(t.keterangan)}</strong><span>${safe(t.waktu)}</span></div>`).join('');
        }
        $('#tracking-form').addEventListener('submit', e => {
            e.preventDefault();
            const num = q.value.trim().toUpperCase(), o = visibleOrders().find(t => t.no.toUpperCase() === num);
            if (!o) {
                result.hidden = true;
                empty.hidden = false;
                $('#tracking-not-found').textContent = `Nomor ${num} tidak ditemukan dalam data pengiriman akun ini.`;
                toast('Nomor pesanan tidak ditemukan.', 'error');
                return;
            }
            show(o);
            toast('Informasi pengiriman berhasil ditemukan.');
        });
        const params = new URLSearchParams(location.search);
        if (params.get('do')) {
            q.value = params.get('do');
            $('#tracking-form').requestSubmit();
        }
    }
    function showDetail(order) {
        $('#detail-no').textContent = order.no;
        $('#detail-content').innerHTML = `<div class="detail-grid"><div><div class="detail-label">Pemesan</div><strong>${safe(order.name)}</strong></div><div><div class="detail-label">Tanggal</div><strong>${formatDate(order.created)}</strong></div><div><div class="detail-label">Status</div>${statusBadge(order.status)}</div><div><div class="detail-label">Pengiriman</div><strong>${safe(order.expedition)}</strong></div><div><div class="detail-label">Pembayaran</div><strong>${safe(order.method)}</strong></div><div><div class="detail-label">Total</div><strong>${rupiah(order.total)}</strong></div></div><hr class="subtle-divider"><h3>Detail buku</h3>${order.lines?.length ? order.lines.map(line => `<div class="sum-row"><span>${safe(line.name)} × ${safe(line.quantity)}</span><strong>${rupiah(line.quantity * line.unitPrice)}</strong></div>`).join('') : '<p class="muted">Rincian buku tidak tersedia pada data pengiriman contoh.</p>'}<hr class="subtle-divider"><a class="btn btn-outline btn-sm" href="tracking.html?do=${encodeURIComponent(order.no)}">Lacak pengiriman →</a>`;
        openDialog('detail-modal');
    }
    function initHistory() {
        const input = $('#history-search');
        function render() {
            const orders = visibleOrders().filter(o => normalize(`${o.no} ${o.name} ${o.expedition} ${o.status}`).includes(normalize(input.value)));
            $('#history-count').textContent = `${orders.length} transaksi`;
            $('#history-rows').innerHTML = orders.length ? orders.map(o => `<tr><td><strong>${safe(o.no)}</strong><div class="caption">${formatDate(o.created)}</div></td><td>${safe(o.name)}</td><td>${safe(o.expedition)}</td><td>${statusBadge(o.status)}</td><td><strong>${rupiah(o.total)}</strong></td><td><button class="btn btn-outline btn-sm" data-detail="${safe(o.no)}">Detail</button></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty"><h3>Belum ada transaksi</h3><p>Pesanan yang dibuat akan muncul di sini.</p></div></td></tr>`;
            $$('[data-detail]').forEach(btn => btn.addEventListener('click', () => showDetail(orders.find(o => o.no === btn.dataset.detail))));
        }
        input.addEventListener('input', render);
        render();
    }
    function initReport() {
        const s = $('#report-status'), q = $('#report-search');
        function render() {
            const all = visibleOrders(), filtered = all.filter(o => (s.value === 'all' || s.value === o.status) && normalize(`${o.no} ${o.name} ${o.method}`).includes(normalize(q.value)));
            $('#report-count').textContent = filtered.length;
            $('#report-revenue').textContent = rupiah(filtered.reduce((a, o) => a + o.total, 0));
            $('#report-shipping').textContent = filtered.filter(o => /dikirim|perjalanan/i.test(o.status) && !/selesai|diterima/i.test(o.status)).length;
            $('#report-rows').innerHTML = filtered.length ? filtered.map((o, i) => `<tr><td>${i + 1}</td><td><strong>${safe(o.no)}</strong></td><td>${formatDate(o.created)}</td><td>${safe(o.name)}</td><td>${safe(o.method)}</td><td>${statusBadge(o.status)}</td><td class="right"><strong>${rupiah(o.total)}</strong></td></tr>`).join('') : `<tr><td colspan="7"><div class="empty"><h3>Tidak ada data</h3><p>Sesuaikan pencarian atau buat pesanan terlebih dahulu.</p></div></td></tr>`;
        }
        s.addEventListener('change', render);
        q.addEventListener('input', render);
        $('#print-report').addEventListener('click', () => window.print());
        render();
    }
    document.addEventListener('DOMContentLoaded', () => {
        initDialogs();
        if (PAGE === 'login') {
            initLogin();
            return;
        }
        if (!person()) {
            location.replace('index.html');
            return;
        }
        renderShell();
        const fn = { dashboard: initDashboard, stok: initStock, checkout: initCheckout, tracking: initTracking, riwayat: initHistory, laporan: initReport }[PAGE];
        if (fn)
            fn();
    });
})();
