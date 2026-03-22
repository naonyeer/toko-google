// ==========================================
// My Kedai - Google Spreadsheet Database App
// ==========================================

// ==================== SPREADSHEET DATABASE ====================
const DB = {
    apiUrl: '',
    connected: false,
    cache: { products: [], transactions: [] },

    isLocalDev() {
        return ['127.0.0.1', 'localhost'].includes(window.location.hostname);
    },

    buildRequestUrl(action) {
        if (this.isLocalDev()) {
            return `/api?action=${encodeURIComponent(action)}&target=${encodeURIComponent(this.apiUrl)}`;
        }
        return this.apiUrl + '?action=' + action;
    },

    async parseResponse(response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (error) {
            if (text.includes('Fungsi skrip tidak ditemukan: doGet')) {
                throw new Error('Apps Script yang dipakai belum berisi doGet/doPost. Paste ulang `Code.gs` terbaru lalu deploy ulang Web App.');
            }
            if (text.includes('<!DOCTYPE html')) {
                throw new Error('Apps Script mengembalikan halaman HTML, bukan JSON. Cek URL Web App dan deploy Apps Script terbaru.');
            }
            throw new Error('Respons backend tidak valid. ' + text.slice(0, 160));
        }
    },

    init() {
        this.apiUrl = localStorage.getItem('mykedai_apiUrl') || '';
        if (this.apiUrl) {
            this.connected = true;
            this.updateSyncStatus(true);
        }
    },

    setApiUrl(url) {
        this.apiUrl = url;
        localStorage.setItem('mykedai_apiUrl', url);
        this.connected = !!url;
        this.updateSyncStatus(!!url);
    },

    updateSyncStatus(connected) {
        const dot = document.querySelector('.sync-dot');
        const txt = document.querySelector('.sync-status span');
        if (dot && txt) {
            dot.className = 'sync-dot ' + (connected ? 'synced' : 'disconnected');
            txt.textContent = connected ? 'Terhubung ke Spreadsheet' : 'Belum terhubung';
        }
    },

    async request(action, data = null) {
        if (!this.apiUrl) throw new Error('API URL belum dikonfigurasi. Buka Pengaturan.');

        const url = this.buildRequestUrl(action);

        try {
            let response;
            if (data) {
                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(data)
                });
            } else {
                response = await fetch(url);
            }

            const result = await this.parseResponse(response);
            this.updateSyncStatus(true);
            return result;
        } catch (err) {
            console.error('DB Error:', err);
            this.updateSyncStatus(false);
            throw err;
        }
    },

    // Smart request that handles CORS via redirect
    async apiCall(action, data = null) {
        if (!this.apiUrl) throw new Error('API URL belum dikonfigurasi!');

        let url = this.buildRequestUrl(action);

        if (data) {
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                redirect: 'follow'
            });
            const result = await this.parseResponse(response);
            this.updateSyncStatus(true);
            return result;
        } else {
            const response = await fetch(url, { redirect: 'follow' });
            const result = await this.parseResponse(response);
            this.updateSyncStatus(true);
            return result;
        }
    },

    // ---- Products ----
    async getProducts() {
        try {
            const res = await this.apiCall('getProducts');
            if (res.status === 'ok') {
                this.cache.products = res.data;
                return res.data;
            }
        } catch (e) {
            console.warn('Fallback ke cache produk:', e.message);
        }
        return this.cache.products;
    },

    async addProduct(product) {
        const res = await this.apiCall('addProduct', product);
        await this.getProducts(); // refresh cache
        return res;
    },

    async updateProduct(product) {
        const res = await this.apiCall('updateProduct', product);
        await this.getProducts();
        return res;
    },

    async deleteProduct(id) {
        const res = await this.apiCall('deleteProduct', { id });
        await this.getProducts();
        return res;
    },

    // ---- Transactions ----
    async getTransactions() {
        try {
            const res = await this.apiCall('getTransactions');
            if (res.status === 'ok') {
                this.cache.transactions = res.data;
                return res.data;
            }
        } catch (e) {
            console.warn('Fallback ke cache transaksi:', e.message);
        }
        return this.cache.transactions;
    },

    async addTransaction(txn) {
        const res = await this.apiCall('addTransaction', txn);
        await this.getProducts(); // refresh stock cache
        return res;
    },

    async deleteTransaction(id) {
        const res = await this.apiCall('deleteTransaction', { id });
        if (res.status !== 'ok') throw new Error(res.message || 'Gagal menghapus transaksi');
        await this.getProducts();
        await this.getTransactions();
        return res;
    },

    // ---- Store Info ----
    async getStoreInfo() {
        try {
            const res = await this.apiCall('getStoreInfo');
            if (res.status === 'ok') return res.data;
        } catch (e) { /* fallback */ }
        return { name: 'My Kedai', address: '', phone: '' };
    },

    async saveStoreInfo(info) {
        return await this.apiCall('saveStoreInfo', info);
    },

    // ---- Ping ----
    async ping() {
        return await this.apiCall('ping');
    }
};

// ==================== UTILITY ====================
const Utils = {
    formatRupiah(n) { return 'Rp ' + (n || 0).toLocaleString('id-ID'); },
    formatDate(d) { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); },
    formatDateTime(d) { return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); },
    generateTxId() { return 'TXN-' + Date.now().toString().slice(-8); },
    isToday(d) { const t = new Date(), dd = new Date(d); return t.toDateString() === dd.toDateString(); },
    daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d; },
    categoryEmoji(cat) {
        const map = { 'Makanan': '🍚', 'Minuman': '🥤', 'Snack': '🍿', 'Rokok': '🚬', 'Alat': '🛠️', 'Kebutuhan Rumah': '🏠', 'Elektronik': '⚡', 'Lainnya': '📦' };
        return map[cat] || '📦';
    },
    toast(msg, type = 'success') {
        const c = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = 'toast ' + type;
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
    },
    showLoading(el) {
        if (el) el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Memuat data dari Spreadsheet...</p></div>';
    }
};

// ==================== APP NAVIGATION ====================
const App = {
    async init() {
        DB.init();
        this.setupNav();
        this.updateDate();
        this.setupMobile();

        if (!DB.apiUrl) {
            // Show setup guide if no API URL configured
            this.showSetupGuide();
        } else {
            // Load data from spreadsheet
            await this.loadInitialData();
        }
    },

    showSetupGuide() {
        // Navigate to settings page
        this.navigateTo('pengaturan');
        Utils.toast('Silakan konfigurasi URL Google Apps Script terlebih dahulu!', 'warning');
    },

    async loadInitialData() {
        try {
            Utils.toast('Memuat data dari Spreadsheet...', 'info');
            await DB.getProducts();
            await DB.getTransactions();
            Dashboard.refresh();
            Utils.toast('Data berhasil dimuat!', 'success');
        } catch (e) {
            Utils.toast('Gagal memuat data: ' + e.message, 'error');
        }
    },

    setupNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(item.dataset.page);
            });
        });
    },

    navigateTo(page) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const navEl = document.querySelector(`[data-page="${page}"]`);
        const pageEl = document.getElementById('page-' + page);
        if (navEl) navEl.classList.add('active');
        if (pageEl) pageEl.classList.add('active');
        // Refresh page data
        if (page === 'dashboard') Dashboard.refresh();
        if (page === 'kasir') Kasir.refresh();
        if (page === 'produk') Products.refresh();
        if (page === 'riwayat') History.refresh();
        if (page === 'statistik') Stats.refresh();
        if (page === 'pengaturan') Settings.refresh();
        document.getElementById('sidebar').classList.remove('open');
    },

    setupMobile() {
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
        document.getElementById('mainContent').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
    },

    updateDate() {
        const el = document.getElementById('currentDate');
        if (el) el.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
};

// ==================== DASHBOARD ====================
const Dashboard = {
    chart: null,
    async refresh() {
        const products = DB.cache.products;
        const txns = DB.cache.transactions;
        const todayTxns = txns.filter(t => Utils.isToday(t.date));
        const todayRev = todayTxns.reduce((s, t) => s + t.total, 0);
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yTxns = txns.filter(t => new Date(t.date).toDateString() === yesterday.toDateString());
        const yRev = yTxns.reduce((s, t) => s + t.total, 0);

        document.getElementById('todayRevenue').textContent = Utils.formatRupiah(todayRev);
        document.getElementById('todayTransactions').textContent = todayTxns.length;
        document.getElementById('totalProducts').textContent = products.length;
        document.getElementById('lowStock').textContent = products.filter(p => p.stock <= 5).length;

        const revChange = yRev > 0 ? Math.round(((todayRev - yRev) / yRev) * 100) : 0;
        const txnChange = yTxns.length > 0 ? Math.round(((todayTxns.length - yTxns.length) / yTxns.length) * 100) : 0;
        this.setChange('revenueChange', revChange);
        this.setChange('transactionChange', txnChange);
        this.renderChart(txns);
        this.renderTopProducts(txns);
        this.renderRecentTransactions(txns);
    },
    setChange(id, pct) {
        const el = document.getElementById(id);
        if (!el) return;
        const cls = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
        el.className = 'stat-change ' + cls;
        el.textContent = `${pct > 0 ? '+' : ''}${pct}% dari kemarin`;
    },
    renderChart(txns) {
        const labels = [], data = [];
        for (let i = 6; i >= 0; i--) {
            const d = Utils.daysAgo(i);
            labels.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
            data.push(txns.filter(t => new Date(t.date).toDateString() === d.toDateString()).reduce((s, t) => s + t.total, 0));
        }
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;
        if (this.chart) this.chart.destroy();
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Pendapatan', data, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointBackgroundColor: '#6366f1', pointRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', callback: v => 'Rp ' + (v / 1000) + 'k' } } } }
        });
    },
    renderTopProducts(txns) {
        const map = {};
        txns.forEach(t => (t.items || []).forEach(it => {
            if (!map[it.name]) map[it.name] = { qty: 0, rev: 0 };
            map[it.name].qty += it.qty; map[it.name].rev += it.price * it.qty;
        }));
        const sorted = Object.entries(map).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
        const el = document.getElementById('topProducts');
        if (!sorted.length) { el.innerHTML = '<div class="empty-state-small">Belum ada data penjualan</div>'; return; }
        el.innerHTML = sorted.map(([name, d], i) => `<div class="top-product-item"><div class="top-product-rank ${i < 3 ? 'rank-' + (i + 1) : 'rank-other'}">${i + 1}</div><div class="top-product-info"><div class="top-product-name">${name}</div><div class="top-product-sold">${d.qty} terjual</div></div><div class="top-product-revenue">${Utils.formatRupiah(d.rev)}</div></div>`).join('');
    },
    renderRecentTransactions(txns) {
        const recent = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        const el = document.getElementById('recentTransactions');
        if (!recent.length) { el.innerHTML = '<tr><td colspan="5" class="empty-state-small">Belum ada transaksi</td></tr>'; return; }
        el.innerHTML = recent.map(t => {
            const items = (t.items || []).map(i => i.name).join(', ');
            return `<tr><td style="color:var(--text-primary);font-weight:600">${t.id}</td><td>${Utils.formatDateTime(t.date)}</td><td>${items.length > 30 ? items.slice(0, 30) + '...' : items}</td><td style="font-weight:700;color:var(--accent-blue)">${Utils.formatRupiah(t.total)}</td><td><span class="badge badge-${t.method}">${t.method}</span></td></tr>`;
        }).join('');
    }
};

// ==================== KASIR (POS) ====================
const Kasir = {
    cart: [],
    paymentMethod: 'tunai',
    init() {
        document.getElementById('productSearch').addEventListener('input', () => this.renderProducts());
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.paymentMethod = btn.dataset.method;
                document.getElementById('tunaiInput').style.display = this.paymentMethod === 'tunai' ? 'block' : 'none';
            });
        });
        document.getElementById('cashReceived').addEventListener('input', () => {
            const total = this.getTotal();
            const cash = parseInt(document.getElementById('cashReceived').value) || 0;
            const cd = document.getElementById('changeDisplay');
            if (cash > 0) { cd.style.display = 'flex'; document.getElementById('changeAmount').textContent = Utils.formatRupiah(Math.max(0, cash - total)); }
            else cd.style.display = 'none';
        });
    },
    async refresh() {
        if (DB.connected) {
            try { await DB.getProducts(); } catch (e) { }
        }
        this.renderProducts();
        this.renderCategories();
    },
    renderCategories() {
        const cats = [...new Set(DB.cache.products.map(p => p.category))];
        const el = document.getElementById('categoryFilters');
        el.innerHTML = '<button class="filter-btn active" data-category="all">Semua</button>' + cats.map(c => `<button class="filter-btn" data-category="${c}">${c}</button>`).join('');
        el.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => { el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); this.renderProducts(); });
        });
    },
    renderProducts() {
        const search = document.getElementById('productSearch').value.toLowerCase();
        const catBtn = document.querySelector('.category-filters .filter-btn.active');
        const cat = catBtn ? catBtn.dataset.category : 'all';
        let filtered = DB.cache.products;
        if (cat !== 'all') filtered = filtered.filter(p => p.category === cat);
        if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
        const el = document.getElementById('kasirProductGrid');
        if (!filtered.length) { el.innerHTML = '<div class="empty-state-small">Tidak ada produk ditemukan</div>'; return; }
        el.innerHTML = filtered.map(p => {
            const sc = p.stock <= 0 ? 'empty' : p.stock <= 5 ? 'low' : '';
            return `<div class="product-tile ${p.stock <= 0 ? 'out-of-stock' : ''}" onclick="Kasir.addToCart('${p.id}')"><span class="tile-emoji">${Utils.categoryEmoji(p.category)}</span><div class="tile-name">${p.name}</div><div class="tile-price">${Utils.formatRupiah(p.price)}</div><div class="tile-stock ${sc}">Stok: ${p.stock}</div></div>`;
        }).join('');
    },
    addToCart(pid) {
        const p = DB.cache.products.find(pp => pp.id === pid);
        if (!p || p.stock <= 0) return;
        const ex = this.cart.find(i => i.productId === pid);
        if (ex) { if (ex.qty >= p.stock) { Utils.toast('Stok tidak mencukupi!', 'warning'); return; } ex.qty++; }
        else this.cart.push({ productId: pid, name: p.name, price: p.price, cost: p.cost, qty: 1, maxStock: p.stock });
        this.renderCart();
    },
    removeFromCart(i) { this.cart.splice(i, 1); this.renderCart(); },
    updateQty(i, d) {
        this.cart[i].qty += d;
        if (this.cart[i].qty <= 0) this.cart.splice(i, 1);
        else if (this.cart[i].qty > this.cart[i].maxStock) { this.cart[i].qty = this.cart[i].maxStock; Utils.toast('Stok tidak mencukupi!', 'warning'); }
        this.renderCart();
    },
    clearCart() { this.cart = []; this.renderCart(); },
    getTotal() { return this.cart.reduce((s, i) => s + i.price * i.qty, 0); },
    renderCart() {
        const el = document.getElementById('cartItems');
        if (!this.cart.length) {
            el.innerHTML = '<div class="empty-cart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><p>Keranjang masih kosong</p></div>';
            document.getElementById('cartSubtotal').textContent = 'Rp 0';
            document.getElementById('cartTotal').textContent = 'Rp 0';
            return;
        }
        el.innerHTML = this.cart.map((item, i) => `<div class="cart-item"><div class="cart-item-info"><div class="cart-item-name">${item.name}</div><div class="cart-item-price">${Utils.formatRupiah(item.price)}</div></div><div class="cart-item-controls"><button class="qty-btn" onclick="Kasir.updateQty(${i},-1)">−</button><span class="cart-item-qty">${item.qty}</span><button class="qty-btn" onclick="Kasir.updateQty(${i},1)">+</button></div><div class="cart-item-total">${Utils.formatRupiah(item.price * item.qty)}</div><button class="cart-item-remove" onclick="Kasir.removeFromCart(${i})">✕</button></div>`).join('');
        const total = this.getTotal();
        document.getElementById('cartSubtotal').textContent = Utils.formatRupiah(total);
        document.getElementById('cartTotal').textContent = Utils.formatRupiah(total);
    },
    async processPayment() {
        if (!this.cart.length) { Utils.toast('Keranjang masih kosong!', 'error'); return; }
        if (!DB.connected) { Utils.toast('Belum terhubung ke Spreadsheet!', 'error'); return; }
        const total = this.getTotal();
        let cashReceived = total, change = 0;
        if (this.paymentMethod === 'tunai') {
            cashReceived = parseInt(document.getElementById('cashReceived').value) || 0;
            if (cashReceived < total) { Utils.toast('Uang tidak mencukupi!', 'error'); return; }
            change = cashReceived - total;
        }
        const btn = document.getElementById('processPayment');
        btn.disabled = true; btn.textContent = '⏳ Menyimpan ke Spreadsheet...';
        try {
            const txn = {
                id: Utils.generateTxId(),
                date: new Date().toISOString(),
                items: this.cart.map(c => ({ productId: c.productId, name: c.name, price: c.price, cost: c.cost, qty: c.qty })),
                total, method: this.paymentMethod, cashReceived, change
            };
            await DB.addTransaction(txn);
            // Update local cache immediately
            DB.cache.transactions.push(txn);
            DB.cache.products.forEach(p => { const ci = this.cart.find(c => c.productId === p.id); if (ci) p.stock -= ci.qty; });
            this.showReceipt(txn);
            this.cart = [];
            this.renderCart();
            this.renderProducts();
            document.getElementById('cashReceived').value = '';
            document.getElementById('changeDisplay').style.display = 'none';
            Utils.toast('Transaksi berhasil disimpan ke Spreadsheet! ✅', 'success');
        } catch (e) {
            Utils.toast('Gagal menyimpan: ' + e.message, 'error');
        } finally {
            btn.disabled = false; btn.innerHTML = '💰 Proses Pembayaran';
        }
    },
    showReceipt(txn) {
        const info = { name: document.getElementById('storeName').value || 'My Kedai', address: document.getElementById('storeAddress').value || '', phone: document.getElementById('storePhone').value || '' };
        let html = `<div class="receipt-header"><h4>${info.name}</h4>`;
        if (info.address) html += `<p>${info.address}</p>`;
        if (info.phone) html += `<p>${info.phone}</p>`;
        html += `<p>${Utils.formatDateTime(txn.date)}</p><p>No: ${txn.id}</p></div><div class="receipt-items">`;
        txn.items.forEach(it => { html += `<div class="receipt-item"><span>${it.name} x${it.qty}</span><span>${Utils.formatRupiah(it.price * it.qty)}</span></div>`; });
        html += `</div><div class="receipt-totals"><div class="receipt-total-row grand"><span>TOTAL</span><span>${Utils.formatRupiah(txn.total)}</span></div><div class="receipt-total-row"><span>Bayar (${txn.method})</span><span>${Utils.formatRupiah(txn.cashReceived)}</span></div>`;
        if (txn.method === 'tunai') html += `<div class="receipt-total-row"><span>Kembalian</span><span>${Utils.formatRupiah(txn.change)}</span></div>`;
        html += '</div><div class="receipt-footer"><p>Terima kasih telah berbelanja!</p></div>';
        document.getElementById('receiptContent').innerHTML = html;
        document.getElementById('receiptModal').classList.add('active');
    },
    closeReceipt() { document.getElementById('receiptModal').classList.remove('active'); },
    printReceipt() { window.print(); }
};

// ==================== PRODUCTS ====================
const Products = {
    init() {
        document.getElementById('productManageSearch').addEventListener('input', () => this.renderList());
    },
    async refresh() {
        if (DB.connected) try { await DB.getProducts(); } catch (e) { }
        this.renderList();
    },
    renderList() {
        const search = document.getElementById('productManageSearch').value.toLowerCase();
        let filtered = DB.cache.products;
        if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
        const el = document.getElementById('productsList');
        if (!filtered.length) { el.innerHTML = '<tr><td colspan="6" class="empty-state-small">Tidak ada produk</td></tr>'; return; }
        el.innerHTML = filtered.map(p => `<tr><td style="color:var(--text-primary);font-weight:600">${Utils.categoryEmoji(p.category)} ${p.name}</td><td>${p.category}</td><td>${Utils.formatRupiah(p.cost)}</td><td style="font-weight:700;color:var(--accent-blue)">${Utils.formatRupiah(p.price)}</td><td><span style="color:${p.stock <= 5 ? 'var(--accent-orange)' : 'var(--text-secondary)'}">${p.stock}</span></td><td><div class="action-btns"><button class="action-btn" onclick="Products.editProduct('${p.id}')">✏️</button><button class="action-btn delete" onclick="Products.deleteProduct('${p.id}')">🗑️</button></div></td></tr>`).join('');
    },
    showAddModal() {
        document.getElementById('modalTitle').textContent = 'Tambah Produk';
        document.getElementById('editProductId').value = '';
        ['prodName', 'prodStock', 'prodCost', 'prodPrice', 'prodBarcode'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('prodCategory').value = 'Makanan';
        document.getElementById('productModal').classList.add('active');
    },
    editProduct(id) {
        const p = DB.cache.products.find(pp => pp.id === id);
        if (!p) return;
        document.getElementById('modalTitle').textContent = 'Edit Produk';
        document.getElementById('editProductId').value = p.id;
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodCategory').value = p.category;
        document.getElementById('prodStock').value = p.stock;
        document.getElementById('prodCost').value = p.cost;
        document.getElementById('prodPrice').value = p.price;
        document.getElementById('prodBarcode').value = p.barcode || '';
        document.getElementById('productModal').classList.add('active');
    },
    async saveProduct() {
        const name = document.getElementById('prodName').value.trim();
        const category = document.getElementById('prodCategory').value;
        const stock = parseInt(document.getElementById('prodStock').value) || 0;
        const cost = parseInt(document.getElementById('prodCost').value) || 0;
        const price = parseInt(document.getElementById('prodPrice').value) || 0;
        const barcode = document.getElementById('prodBarcode').value.trim();
        if (!name || price <= 0) { Utils.toast('Nama dan harga wajib diisi!', 'error'); return; }
        if (!DB.connected) { Utils.toast('Belum terhubung ke Spreadsheet!', 'error'); return; }

        const btn = document.getElementById('saveProductBtn');
        btn.disabled = true; btn.textContent = '⏳ Menyimpan...';
        try {
            const editId = document.getElementById('editProductId').value;
            if (editId) {
                await DB.updateProduct({ id: editId, name, category, stock, cost, price, barcode });
                Utils.toast('Produk berhasil diupdate di Spreadsheet! ✅', 'success');
            } else {
                const id = Utils.generateId();
                await DB.addProduct({ id, name, category, stock, cost, price, barcode });
                Utils.toast('Produk berhasil ditambah di Spreadsheet! ✅', 'success');
            }
            this.closeModal();
            this.renderList();
        } catch (e) { Utils.toast('Gagal: ' + e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Simpan Produk'; }
    },
    async deleteProduct(id) {
        if (!confirm('Yakin hapus produk ini dari Spreadsheet?')) return;
        try {
            await DB.deleteProduct(id);
            this.renderList();
            Utils.toast('Produk dihapus dari Spreadsheet! ✅', 'info');
        } catch (e) { Utils.toast('Gagal: ' + e.message, 'error'); }
    },
    closeModal() { document.getElementById('productModal').classList.remove('active'); }
};

// ==================== HISTORY ====================
const History = {
    async refresh() {
        if (DB.connected) try { await DB.getTransactions(); } catch (e) { }
        this.renderList();
    },
    renderList() {
        let txns = [...DB.cache.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const filterDate = document.getElementById('filterDate').value;
        if (filterDate) txns = txns.filter(t => t.date.startsWith(filterDate));
        const el = document.getElementById('historyList');
        if (!txns.length) { el.innerHTML = '<tr><td colspan="6" class="empty-state-small">Tidak ada transaksi</td></tr>'; return; }
        el.innerHTML = txns.map(t => {
            const items = (t.items || []).map(i => `${i.name} x${i.qty}`).join(', ');
            return `<tr><td style="color:var(--text-primary);font-weight:600">${t.id}</td><td>${Utils.formatDateTime(t.date)}</td><td>${items.length > 35 ? items.slice(0, 35) + '...' : items}</td><td style="font-weight:700;color:var(--accent-blue)">${Utils.formatRupiah(t.total)}</td><td><span class="badge badge-${t.method}">${t.method}</span></td><td><div class="action-btns"><button class="action-btn" onclick="History.showDetail('${t.id}')">👁️</button><button class="action-btn delete" onclick="History.deleteTransaction('${t.id}')">🗑️</button></div></td></tr>`;
        }).join('');
    },
    filterByDate() { this.renderList(); },
    showDetail(id) {
        const t = DB.cache.transactions.find(tt => tt.id === id);
        if (!t) return;
        let html = `<div style="margin-bottom:1rem"><strong>No:</strong> ${t.id}<br><strong>Tanggal:</strong> ${Utils.formatDateTime(t.date)}<br><strong>Metode:</strong> <span class="badge badge-${t.method}">${t.method}</span></div><table class="data-table"><thead><tr><th>Produk</th><th>Harga</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>`;
        (t.items || []).forEach(i => { html += `<tr><td>${i.name}</td><td>${Utils.formatRupiah(i.price)}</td><td>${i.qty}</td><td style="font-weight:700">${Utils.formatRupiah(i.price * i.qty)}</td></tr>`; });
        html += `</tbody></table><div style="margin-top:1rem;text-align:right"><strong>Total: ${Utils.formatRupiah(t.total)}</strong></div>`;
        document.getElementById('detailContent').innerHTML = html;
        document.getElementById('detailModal').classList.add('active');
    },
    async deleteTransaction(id) {
        if (!DB.connected) { Utils.toast('Belum terhubung ke Spreadsheet!', 'error'); return; }
        if (!confirm('Hapus transaksi ini dari riwayat dan kembalikan stok produknya?')) return;
        try {
            await DB.deleteTransaction(id);
            Dashboard.refresh();
            await this.refresh();
            Stats.refresh();
            Settings.refresh();
            this.closeDetail();
            Utils.toast('Transaksi berhasil dihapus.', 'success');
        } catch (e) {
            Utils.toast('Gagal menghapus transaksi: ' + e.message, 'error');
        }
    },
    closeDetail() { document.getElementById('detailModal').classList.remove('active'); }
};

// ==================== STATISTICS ====================
const Stats = {
    charts: {},
    async refresh() {
        if (DB.connected) try { await DB.getTransactions(); } catch (e) { }
        const days = parseInt(document.getElementById('statsPeriod').value) || 7;
        const txns = DB.cache.transactions.filter(t => new Date(t.date) >= Utils.daysAgo(days));
        const totalRev = txns.reduce((s, t) => s + t.total, 0);
        const totalProfit = txns.reduce((s, t) => s + (t.items || []).reduce((ss, i) => ss + (i.price - (i.cost || 0)) * i.qty, 0), 0);
        document.getElementById('statsTotalRevenue').textContent = Utils.formatRupiah(totalRev);
        document.getElementById('statsTotalProfit').textContent = Utils.formatRupiah(totalProfit);
        document.getElementById('statsTotalTransactions').textContent = txns.length;
        document.getElementById('statsAvgTransaction').textContent = Utils.formatRupiah(txns.length ? Math.round(totalRev / txns.length) : 0);
        this.renderRevenueChart(txns, days);
        this.renderPaymentChart(txns);
        this.renderCategoryChart(txns);
        this.renderTopProducts(txns);
    },
    changePeriod() { this.refresh(); },
    renderRevenueChart(txns, days) {
        const labels = [], data = [], step = days > 30 ? 7 : 1;
        for (let i = days - 1; i >= 0; i -= step) {
            const d = Utils.daysAgo(i); labels.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
            let total = 0; for (let j = 0; j < step; j++) { const dd = Utils.daysAgo(i - j); total += txns.filter(t => new Date(t.date).toDateString() === dd.toDateString()).reduce((s, t) => s + t.total, 0); }
            data.push(total);
        }
        const ctx = document.getElementById('revenueChart'); if (this.charts.revenue) this.charts.revenue.destroy();
        this.charts.revenue = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Pendapatan', data, backgroundColor: 'rgba(99,102,241,0.6)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', callback: v => 'Rp' + (v / 1000) + 'k' } } } } });
    },
    renderPaymentChart(txns) {
        const m = { tunai: 0, transfer: 0, qris: 0 }; txns.forEach(t => { if (m[t.method] !== undefined) m[t.method]++; });
        const ctx = document.getElementById('paymentChart'); if (this.charts.payment) this.charts.payment.destroy();
        this.charts.payment = new Chart(ctx, { type: 'doughnut', data: { labels: ['Tunai', 'Transfer', 'QRIS'], datasets: [{ data: Object.values(m), backgroundColor: ['#10b981', '#6366f1', '#8b5cf6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 15 } } }, cutout: '65%' } });
    },
    renderCategoryChart(txns) {
        const cats = {}; txns.forEach(t => (t.items || []).forEach(i => { const p = DB.cache.products.find(pp => pp.id === i.productId); cats[p ? p.category : 'Lainnya'] = (cats[p ? p.category : 'Lainnya'] || 0) + i.price * i.qty; }));
        const ctx = document.getElementById('categoryChart'); if (this.charts.category) this.charts.category.destroy();
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
        this.charts.category = new Chart(ctx, { type: 'pie', data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: colors.slice(0, Object.keys(cats).length), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12 } } } } });
    },
    renderTopProducts(txns) {
        const map = {}; txns.forEach(t => (t.items || []).forEach(it => { if (!map[it.name]) map[it.name] = { qty: 0, rev: 0 }; map[it.name].qty += it.qty; map[it.name].rev += it.price * it.qty; }));
        const sorted = Object.entries(map).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
        const el = document.getElementById('statsTopProducts');
        if (!sorted.length) { el.innerHTML = '<div class="empty-state-small">Belum ada data</div>'; return; }
        el.innerHTML = sorted.map(([name, d], i) => `<div class="top-product-item"><div class="top-product-rank ${i < 3 ? 'rank-' + (i + 1) : 'rank-other'}">${i + 1}</div><div class="top-product-info"><div class="top-product-name">${name}</div><div class="top-product-sold">${d.qty} terjual</div></div><div class="top-product-revenue">${Utils.formatRupiah(d.rev)}</div></div>`).join('');
    }
};

// ==================== SETTINGS ====================
const Settings = {
    async init() {
        // Load API URL
        const apiUrl = localStorage.getItem('mykedai_apiUrl') || '';
        document.getElementById('appsScriptUrl').value = apiUrl;

        // Load store info from cache or spreadsheet
        if (DB.connected) {
            try {
                const info = await DB.getStoreInfo();
                document.getElementById('storeName').value = info.name || 'My Kedai';
                document.getElementById('storeAddress').value = info.address || '';
                document.getElementById('storePhone').value = info.phone || '';
            } catch (e) { }
        }
    },
    refresh() {
        document.getElementById('storedProducts').textContent = DB.cache.products.length;
        document.getElementById('storedTransactions').textContent = DB.cache.transactions.length;
        document.getElementById('appsScriptUrl').value = DB.apiUrl || '';
    },
    saveSpreadsheetConfig() {
        const url = document.getElementById('appsScriptUrl').value.trim();
        if (!url) { Utils.toast('Masukkan URL Apps Script!', 'error'); return; }
        DB.setApiUrl(url);
        Utils.toast('URL Spreadsheet berhasil disimpan! ✅', 'success');
    },
    async testConnection() {
        if (!DB.apiUrl) { Utils.toast('Masukkan URL terlebih dahulu!', 'error'); return; }
        Utils.toast('Menguji koneksi ke Spreadsheet...', 'info');
        try {
            const res = await DB.ping();
            if (res.status === 'ok') {
                Utils.toast('✅ ' + (res.message || 'Koneksi berhasil!'), 'success');
                // Load all data
                await App.loadInitialData();
            } else {
                Utils.toast('❌ Koneksi gagal', 'error');
            }
        } catch (e) {
            Utils.toast('❌ Gagal: ' + e.message, 'error');
        }
    },
    async saveStoreInfo() {
        if (!DB.connected) { Utils.toast('Belum terhubung ke Spreadsheet!', 'error'); return; }
        try {
            await DB.saveStoreInfo({
                name: document.getElementById('storeName').value,
                address: document.getElementById('storeAddress').value,
                phone: document.getElementById('storePhone').value
            });
            Utils.toast('Info toko disimpan ke Spreadsheet! ✅', 'success');
        } catch (e) { Utils.toast('Gagal: ' + e.message, 'error'); }
    },
    exportData() {
        const products = DB.cache.products;
        const txns = DB.cache.transactions;
        let csv = 'Nama,Kategori,Harga Beli,Harga Jual,Stok,Barcode\n';
        products.forEach(p => { csv += `"${p.name}","${p.category}",${p.cost},${p.price},${p.stock},"${p.barcode || ''}"\n`; });
        this.downloadCSV(csv, 'produk_mykedai.csv');
        let tcsv = 'No Transaksi,Tanggal,Items,Total,Metode\n';
        txns.forEach(t => { tcsv += `"${t.id}","${t.date}","${(t.items || []).map(i => i.name + 'x' + i.qty).join('; ')}",${t.total},"${t.method}"\n`; });
        this.downloadCSV(tcsv, 'transaksi_mykedai.csv');
        Utils.toast('Data berhasil diexport!', 'success');
    },
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' }); const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    }
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    Kasir.init();
    Products.init();
    App.init();
});
