active.querySelectorAll('input,select').forEach((el) => {
  if (el.type === 'file' || el.type === 'hidden') return;

  const value = el.tagName === 'SELECT'
    ? (el.selectedOptions?.[0]?.textContent || '')
    : String(el.value || '').trim();

  if (value) values.push(value);
});

return values.length ? values.join(' — ') : 'كل البيانات';
