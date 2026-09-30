(function () {
  function filterText(active) {
    const values = [];
    active.querySelectorAll('input,select').forEach(el => {
      if (el.type === 'file' || el.type === 'hidden') return;
      const value = el.tagName === 'SELECT'
        ? (el.selectedOptions?.[0]?.textContent || '')
        : String(el.value || '').trim();
      if (value) values.push(value);
    });
    return values.length ? values.join(' — ') : 'كل البيانات';
  }

  async function googlePrint() {
    const active = document.querySelector('.screen.active');
    const table = active?.querySelector('table');
    if (!active || !table) return alert('لا يوجد جدول في الشاشة الحالية للطباعة.');
    if (typeof XLSX === 'undefined') return alert('مكتبة Excel غير متاحة. أعد تحميل الصفحة.');

    const popup = window.open('', '_blank');
    if (!popup) return alert('اسمح بفتح النوافذ المنبثقة ثم أعد المحاولة.');
    popup.document.write('<p style="font-family:Arial;text-align:center">جارٍ تجهيز ملف PDF...</p>');

    try {
      const ws = XLSX.utils.table_to_sheet(table, { raw: false });
      const title = (active.querySelector('h1,h2,h3')?.textContent || 'تقرير جمعية المبادرة').trim();
      XLSX.utils.sheet_add_aoa(ws, [[title], ['الفلترة الحالية: ' + filterText(active)], ['']], { origin: 'A1' });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
      const bytes = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }

      const response = await fetch('/api/convert-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'جمعية_المبادرة_' + new Date().toISOString().slice(0, 10) + '.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileBase64: btoa(binary)
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'تعذر إنشاء PDF');

      const raw = atob(result.pdfBase64);
      const pdfBytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) pdfBytes[i] = raw.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
      popup.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (error) {
      popup.close();
      console.error(error);
      alert('تعذر إنشاء ملف PDF: ' + (error.message || error));
    }
  }

  window.printCurrentScreen = googlePrint;
  window.printCollectionStandalone = googlePrint;
  window.printRiskReport = googlePrint;
  window.printClientsReport = googlePrint;
  window.printCollectionReport = googlePrint;
  window.downloadCurrentPDF = googlePrint;
})();
