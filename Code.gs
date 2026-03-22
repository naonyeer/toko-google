/**
 * ============================================
 * TokoKu - Google Apps Script Backend
 * ============================================
 * CARA SETUP:
 * 1. Buat Google Spreadsheet baru
 * 2. Buka Extensions > Apps Script
 * 3. Hapus semua kode dan paste kode ini
 * 4. Klik Deploy > New deployment
 * 5. Pilih "Web app"
 * 6. Set "Execute as" = Me, "Who has access" = Anyone
 * 7. Klik Deploy dan copy URL-nya
 * 8. Paste URL ke Pengaturan di aplikasi My Kedai
 */

// ============ CONFIG ============
const SHEET_PRODUK = 'Produk';
const SHEET_TRANSAKSI = 'Transaksi';
const SHEET_DETAIL = 'DetailTransaksi';
const SHEET_INFO = 'InfoToko';

// ============ SETUP SHEETS ============
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet Produk
  let sp = ss.getSheetByName(SHEET_PRODUK);
  if (!sp) {
    sp = ss.insertSheet(SHEET_PRODUK);
    sp.appendRow(['id', 'nama', 'kategori', 'hargaBeli', 'hargaJual', 'stok', 'barcode', 'createdAt', 'updatedAt']);
    sp.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#fff');
    sp.setFrozenRows(1);
  }
  
  // Sheet Transaksi
  let st = ss.getSheetByName(SHEET_TRANSAKSI);
  if (!st) {
    st = ss.insertSheet(SHEET_TRANSAKSI);
    st.appendRow(['id', 'tanggal', 'total', 'metode', 'uangDiterima', 'kembalian', 'itemCount']);
    st.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#6aa84f').setFontColor('#fff');
    st.setFrozenRows(1);
  }
  
  // Sheet Detail Transaksi
  let sd = ss.getSheetByName(SHEET_DETAIL);
  if (!sd) {
    sd = ss.insertSheet(SHEET_DETAIL);
    sd.appendRow(['transaksiId', 'productId', 'namaProduk', 'hargaJual', 'hargaBeli', 'qty', 'subtotal']);
    sd.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#e69138').setFontColor('#fff');
    sd.setFrozenRows(1);
  }
  
  // Sheet Info Toko
  let si = ss.getSheetByName(SHEET_INFO);
  if (!si) {
    si = ss.insertSheet(SHEET_INFO);
    si.appendRow(['key', 'value']);
    si.appendRow(['nama', 'TokoKu']);
    si.appendRow(['alamat', '']);
    si.appendRow(['telepon', '']);
    si.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#a64d79').setFontColor('#fff');
  }
  
  return 'Setup selesai!';
}

// ============ WEB APP HANDLERS ============
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    // Setup sheets jika belum ada
    setupSheets();
    
    const params = e.parameter || {};
    const action = params.action || '';
    
    // Jika POST, ambil data dari body
    let postData = {};
    if (e.postData) {
      try { postData = JSON.parse(e.postData.contents); } catch(err) { postData = {}; }
    }
    
    let result;
    
    switch (action) {
      // ---- PRODUK ----
      case 'getProducts':
        result = getProducts();
        break;
      case 'addProduct':
        result = addProduct(postData);
        break;
      case 'updateProduct':
        result = updateProduct(postData);
        break;
      case 'deleteProduct':
        result = deleteProduct(params.id || postData.id);
        break;
      case 'updateStock':
        result = updateStock(postData.items);
        break;
        
      // ---- TRANSAKSI ----
      case 'getTransactions':
        result = getTransactions();
        break;
      case 'addTransaction':
        result = addTransaction(postData);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(params.id || postData.id);
        break;
        
      // ---- INFO TOKO ----
      case 'getStoreInfo':
        result = getStoreInfo();
        break;
      case 'saveStoreInfo':
        result = saveStoreInfo(postData);
        break;
      
      // ---- TEST ----
      case 'ping':
        result = { status: 'ok', message: 'My Kedai API terhubung!' };
        break;
        
      default:
        result = { status: 'ok', message: 'My Kedai API aktif. Gunakan parameter action.' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============ PRODUK FUNCTIONS ============
function getProducts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUK);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return { status: 'ok', data: [] };
  
  const headers = data[0];
  const products = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // skip empty rows
    products.push({
      id: String(row[0]),
      name: String(row[1]),
      category: String(row[2]),
      cost: Number(row[3]),
      price: Number(row[4]),
      stock: Number(row[5]),
      barcode: String(row[6] || '')
    });
  }
  
  return { status: 'ok', data: products };
}

function addProduct(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUK);
  
  const id = data.id || Utilities.getUuid();
  const now = new Date().toISOString();
  
  sheet.appendRow([
    id,
    data.name || '',
    data.category || 'Lainnya',
    Number(data.cost) || 0,
    Number(data.price) || 0,
    Number(data.stock) || 0,
    data.barcode || '',
    now,
    now
  ]);
  
  return { status: 'ok', id: id, message: 'Produk berhasil ditambahkan' };
}

function updateProduct(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUK);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(data.name);
      sheet.getRange(rowNum, 3).setValue(data.category);
      sheet.getRange(rowNum, 4).setValue(Number(data.cost));
      sheet.getRange(rowNum, 5).setValue(Number(data.price));
      sheet.getRange(rowNum, 6).setValue(Number(data.stock));
      sheet.getRange(rowNum, 7).setValue(data.barcode || '');
      sheet.getRange(rowNum, 9).setValue(new Date().toISOString());
      return { status: 'ok', message: 'Produk berhasil diupdate' };
    }
  }
  
  return { status: 'error', message: 'Produk tidak ditemukan' };
}

function deleteProduct(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUK);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { status: 'ok', message: 'Produk berhasil dihapus' };
    }
  }
  
  return { status: 'error', message: 'Produk tidak ditemukan' };
}

function updateStock(items) {
  if (!items || !items.length) return { status: 'error', message: 'No items' };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUK);
  const rows = sheet.getDataRange().getValues();
  
  items.forEach(function(item) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(item.productId)) {
        const currentStock = Number(rows[i][5]);
        sheet.getRange(i + 1, 6).setValue(currentStock - Number(item.qty));
        rows[i][5] = currentStock - Number(item.qty); // update local cache
        break;
      }
    }
  });
  
  return { status: 'ok', message: 'Stok berhasil diupdate' };
}

// ============ TRANSAKSI FUNCTIONS ============
function getTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tSheet = ss.getSheetByName(SHEET_TRANSAKSI);
  const dSheet = ss.getSheetByName(SHEET_DETAIL);
  
  const tData = tSheet.getDataRange().getValues();
  const dData = dSheet.getDataRange().getValues();
  
  if (tData.length <= 1) return { status: 'ok', data: [] };
  
  // Build detail map
  const detailMap = {};
  for (let i = 1; i < dData.length; i++) {
    const txId = String(dData[i][0]);
    if (!detailMap[txId]) detailMap[txId] = [];
    detailMap[txId].push({
      productId: String(dData[i][1]),
      name: String(dData[i][2]),
      price: Number(dData[i][3]),
      cost: Number(dData[i][4]),
      qty: Number(dData[i][5])
    });
  }
  
  const transactions = [];
  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    if (!row[0]) continue;
    const txId = String(row[0]);
    transactions.push({
      id: txId,
      date: String(row[1]),
      total: Number(row[2]),
      method: String(row[3]),
      cashReceived: Number(row[4]),
      change: Number(row[5]),
      items: detailMap[txId] || []
    });
  }
  
  return { status: 'ok', data: transactions };
}

function addTransaction(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tSheet = ss.getSheetByName(SHEET_TRANSAKSI);
  const dSheet = ss.getSheetByName(SHEET_DETAIL);
  
  const txId = data.id || ('TXN-' + Date.now().toString().slice(-8));
  const date = data.date || new Date().toISOString();
  const items = data.items || [];
  
  // Add transaction header
  tSheet.appendRow([
    txId,
    date,
    Number(data.total),
    data.method || 'tunai',
    Number(data.cashReceived) || 0,
    Number(data.change) || 0,
    items.length
  ]);
  
  // Add transaction details
  items.forEach(function(item) {
    dSheet.appendRow([
      txId,
      item.productId || '',
      item.name || '',
      Number(item.price),
      Number(item.cost) || 0,
      Number(item.qty),
      Number(item.price) * Number(item.qty)
    ]);
  });
  
  // Update stock
  updateStock(items);
  
  return { status: 'ok', id: txId, message: 'Transaksi berhasil disimpan' };
}

function deleteTransaction(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tSheet = ss.getSheetByName(SHEET_TRANSAKSI);
  const dSheet = ss.getSheetByName(SHEET_DETAIL);
  const pSheet = ss.getSheetByName(SHEET_PRODUK);
  const transactionRows = tSheet.getDataRange().getValues();
  const detailRows = dSheet.getDataRange().getValues();
  const productRows = pSheet.getDataRange().getValues();
  const targetId = String(id || '');

  if (!targetId) {
    return { status: 'error', message: 'ID transaksi wajib diisi' };
  }

  const detailIndexes = [];
  const stockReturns = {};

  for (let i = 1; i < detailRows.length; i++) {
    if (String(detailRows[i][0]) === targetId) {
      detailIndexes.push(i + 1);
      const productId = String(detailRows[i][1]);
      stockReturns[productId] = (stockReturns[productId] || 0) + Number(detailRows[i][5] || 0);
    }
  }

  let transactionRowNumber = 0;
  for (let i = 1; i < transactionRows.length; i++) {
    if (String(transactionRows[i][0]) === targetId) {
      transactionRowNumber = i + 1;
      break;
    }
  }

  if (!transactionRowNumber) {
    return { status: 'error', message: 'Transaksi tidak ditemukan' };
  }

  Object.keys(stockReturns).forEach(function(productId) {
    for (let i = 1; i < productRows.length; i++) {
      if (String(productRows[i][0]) === productId) {
        const currentStock = Number(productRows[i][5] || 0);
        pSheet.getRange(i + 1, 6).setValue(currentStock + stockReturns[productId]);
        break;
      }
    }
  });

  detailIndexes.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    dSheet.deleteRow(rowNumber);
  });

  tSheet.deleteRow(transactionRowNumber);

  return { status: 'ok', deletedId: targetId, message: 'Transaksi berhasil dihapus' };
}

// ============ INFO TOKO FUNCTIONS ============
function getStoreInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INFO);
  const data = sheet.getDataRange().getValues();
  
  const info = {};
  for (let i = 1; i < data.length; i++) {
    info[data[i][0]] = data[i][1];
  }
  
  return { status: 'ok', data: { name: info.nama || '', address: info.alamat || '', phone: info.telepon || '' } };
}

function saveStoreInfo(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INFO);
  
  // Clear and rewrite
  sheet.clear();
  sheet.appendRow(['key', 'value']);
  sheet.appendRow(['nama', data.name || '']);
  sheet.appendRow(['alamat', data.address || '']);
  sheet.appendRow(['telepon', data.phone || '']);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#a64d79').setFontColor('#fff');
  
  return { status: 'ok', message: 'Info toko berhasil disimpan' };
}
