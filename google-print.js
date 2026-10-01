(function () {
  function filterText(active) {
    const values = [];

    active.querySelectorAll('input,select').forEach((el) => {
      if (el.type === 'file' || el.type === 'hidden') return;

      const value = el.tagName === 'SELECT'
        ? (el.selectedOptions?.[0]?.textContent || '')
        : String(el.value || '').trim();

      if (value) values.push(value);
    });

    return values.length ? values.join(' — ') : 'كل البيانات';
  }

  function base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i]<Generate></Generate>
