(function () {
  function filterText(active) {
    const values = [];
    const dateLabels = {
      dueFrom: 'من تاريخ',
      dueTo: 'إلى تاريخ',
      collectionFrom: 'من تاريخ',
      collectionTo: 'إلى تاريخ',
      riskFrom: 'من تاريخ',
      riskTo: 'إلى تاريخ'
    };

    active.querySelectorAll('input,select').forEach((el) => {
      if (el.type === 'file' || el.type === 'hidden' || el.closest('.export-toolbar')) return;

      const value = el.tagName === 'SELECT'
        ? (el.selectedOptions?.[0]?.textContent || '').trim()
        : String(el.value || '').trim();

      if (!value) return;

      const labelNode = el.closest('div')?.querySelector('label,.filter-label');
      const label = el.title ||
        dateLabels[el.id] ||
        labelNode?.textContent?.trim() ||
        el.getAttribute('aria-label') ||
        el.id ||
        'فلتر';

      values.push(label + ': ' + value);
    });

    return values.length ? values.join('  |  ') : 'كل البيانات';
  }

  function getReportDetails(active, table) {
    const screenTitle = getScreenTitle(active);
    const reportTitle = active?.id === 'dueInstallments'
      ? 'جمعية المبادرة — الأقساط المستحقة للأخصائيين'
      : 'جمعية المبادرة — ' + screenTitle;

    let summaryLabel = 'عدد السجلات';
    let summaryValue = String(table?.querySelectorAll('tbody tr').length || 0);

    if (active?.id === 'dueInstallments') {
      summaryLabel = 'عدد الأقساط المستحقة';
      summaryValue = String(
        active.querySelector('#dueInstallmentsCount')?.textContent?.trim() || summaryValue
      );
    } else {
      const summaryCard = active?.querySelector('.risk-summary-card,.summary-card,.stat-card');
      if (summaryCard) {
        summaryLabel = summaryCard.querySelector('span')?.textContent?.trim() |<Generate></Generate>
